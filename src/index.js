import
{
    InteractionResponseType,
    InteractionType,
    verifyKey
}
from "discord-interactions";

import
{
    buildRotationMessage
}
from "./rotation.js";

const EPHEMERAL_FLAG = 64;

const ADMINISTRATOR_PERMISSION =
    1n << 3n;

const MANAGE_GUILD_PERMISSION =
    1n << 5n;

function getFrontlineRotation(now = new Date())
{
    const elapsed =
        now.getTime() - FRONTLINE_REFERENCE_DATE.getTime();

    const rotationIndex =
        Math.floor(elapsed / ROTATION_MS);

    const currentIndex =
        ((rotationIndex % FRONTLINE_MAPS.length) +
        FRONTLINE_MAPS.length) %
        FRONTLINE_MAPS.length;

    const nextIndex =
        (currentIndex + 1) %
        FRONTLINE_MAPS.length;

    const nextRotation =
        new Date(
            FRONTLINE_REFERENCE_DATE.getTime() +
            (rotationIndex + 1) * ROTATION_MS
        );

    return {
        current: FRONTLINE_MAPS[currentIndex],
        next: FRONTLINE_MAPS[nextIndex],
        nextRotation
    };
}

function buildRotationMessage()
{
    const rotation =
        getFrontlineRotation();

    const currentMap =
        MAP_NAMES[rotation.current];

    const nextMap =
        MAP_NAMES[rotation.next];

    const nextRotationTimestamp =
        Math.floor(
            rotation.nextRotation.getTime() / 1000
        );

    return (
        `⚔️ **Frontline Rotation**\n\n` +
        `🗺️ **Current:** ${currentMap}\n` +
        `⏭️ **Next:** ${nextMap}\n\n` +
        `🔄 **Next rotation:** ` +
        `<t:${nextRotationTimestamp}:R>\n` +
        `🕒 <t:${nextRotationTimestamp}:F>`
    );
}

function canManageGuild(interaction)
{
    const permissions =
        BigInt(
            interaction.member?.permissions ?? "0"
        );

    const isAdministrator =
        (permissions & ADMINISTRATOR_PERMISSION) !== 0n;

    const canManageGuild =
        (permissions & MANAGE_GUILD_PERMISSION) !== 0n;

    return (
        isAdministrator ||
        canManageGuild
    );
}

async function setupAnnouncements(interaction, env)
{
    if (!canManageGuild(interaction))
    {
        return ephemeralResponse(
            "❌ You need **Manage Server** permission " +
            "to configure Frontline announcements."
        );
    }

    const guildId =
        interaction.guild_id;

    const channelId =
        interaction.channel_id;

    if (!guildId || !channelId)
    {
        return ephemeralResponse(
            "❌ This command must be used inside a server channel."
        );
    }

    await env.DB
        .prepare(
            `
            INSERT INTO subscriptions
            (
                guild_id,
                channel_id,
                updated_at
            )
            VALUES (?, ?, ?)
            ON CONFLICT(guild_id)
            DO UPDATE SET
                channel_id = excluded.channel_id,
                updated_at = excluded.updated_at
            `
        )
        .bind(
            guildId,
            channelId,
            Date.now()
        )
        .run();

    return ephemeralResponse(
        `✅ Daily Frontline announcements ` +
        `will be posted in <#${channelId}>.`
    );
}

async function disableAnnouncements(interaction, env)
{
    if (!canManageGuild(interaction))
    {
        return ephemeralResponse(
            "❌ You need **Manage Server** permission " +
            "to disable Frontline announcements."
        );
    }

    const guildId =
        interaction.guild_id;

    if (!guildId)
    {
        return ephemeralResponse(
            "❌ This command must be used inside a server."
        );
    }

    const result =
        await env.DB
            .prepare(
                `
                DELETE FROM subscriptions
                WHERE guild_id = ?
                `
            )
            .bind(guildId)
            .run();

    if (result.meta.changes === 0)
    {
        return ephemeralResponse(
            "ℹ️ Daily Frontline announcements " +
            "were not configured for this server."
        );
    }

    return ephemeralResponse(
        "✅ Daily Frontline announcements have been disabled."
    );
}

async function verifyDiscordRequest(
    request,
    publicKey
)
{
    const signature =
        request.headers.get(
            "x-signature-ed25519"
        );

    const timestamp =
        request.headers.get(
            "x-signature-timestamp"
        );

    const body =
        await request.text();

    if (!signature || !timestamp)
    {
        return {
            isValid: false
        };
    }

    const isValid =
        await verifyKey(
            body,
            signature,
            timestamp,
            publicKey
        );

    if (!isValid)
    {
        return {
            isValid: false
        };
    }

    return {
        isValid: true,
        interaction: JSON.parse(body)
    };
}

function jsonResponse(body, status = 200)
{
    return new Response(
        JSON.stringify(body),
        {
            status,

            headers:
            {
                "Content-Type":
                    "application/json"
            }
        }
    );
}

function messageResponse(content)
{
    return jsonResponse(
    {
        type:
            InteractionResponseType
                .CHANNEL_MESSAGE_WITH_SOURCE,

        data:
        {
            content
        }
    });
}

function ephemeralResponse(content)
{
    return jsonResponse(
    {
        type:
            InteractionResponseType
                .CHANNEL_MESSAGE_WITH_SOURCE,

        data:
        {
            content,
            flags: EPHEMERAL_FLAG
        }
    });
}

export default
{
    async fetch(request, env)
    {
        if (request.method === "GET")
        {
            return new Response(
                "Frontlines Bot is alive!"
            );
        }

        if (request.method !== "POST")
        {
            return new Response(
                "Method not allowed",
                {
                    status: 405
                }
            );
        }

        const verification =
            await verifyDiscordRequest(
                request,
                env.DISCORD_PUBLIC_KEY
            );

        if (!verification.isValid)
        {
            return new Response(
                "Bad request signature.",
                {
                    status: 401
                }
            );
        }

        const interaction =
            verification.interaction;

        if (
            interaction.type ===
            InteractionType.PING
        )
        {
            return jsonResponse(
            {
                type:
                    InteractionResponseType.PONG
            });
        }

        if (
            interaction.type !==
            InteractionType.APPLICATION_COMMAND
        )
        {
            return jsonResponse(
                {
                    error:
                        "Unknown interaction."
                },
                400
            );
        }

        if (interaction.data.name !== "frontlines")
        {
            return jsonResponse(
                {
                    error:
                        "Unknown command."
                },
                400
            );
        }

        const subcommand =
            interaction.data.options?.[0]?.name;

        switch (subcommand)
        {
            case "current":
            {
                return messageResponse(
                    buildRotationMessage()
                );
            }

            case "setup":
            {
                return setupAnnouncements(
                    interaction,
                    env
                );
            }

            case "disable":
            {
                return disableAnnouncements(
                    interaction,
                    env
                );
            }

            default:
            {
                return ephemeralResponse(
                    "❌ Unknown Frontlines command."
                );
            }
        }
    }
};