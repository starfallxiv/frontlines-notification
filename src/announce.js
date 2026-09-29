import
{
    buildRotationMessage
}
from "./rotation.js";

const CLOUDFLARE_API_TOKEN =
    process.env.CLOUDFLARE_API_TOKEN;

const CLOUDFLARE_ACCOUNT_ID =
    process.env.CLOUDFLARE_ACCOUNT_ID;

const D1_DATABASE_ID =
    process.env.D1_DATABASE_ID;

const DISCORD_TOKEN =
    process.env.DISCORD_TOKEN;

function requireEnvironmentVariables()
{
    const required =
    {
        CLOUDFLARE_API_TOKEN,
        CLOUDFLARE_ACCOUNT_ID,
        D1_DATABASE_ID,
        DISCORD_TOKEN
    };

    for (const [name, value] of Object.entries(required))
    {
        if (!value)
        {
            throw new Error(
                `Missing environment variable: ${name}`
            );
        }
    }
}

async function getSubscriptions()
{
    const url =
        `https://api.cloudflare.com/client/v4/accounts/` +
        `${CLOUDFLARE_ACCOUNT_ID}/d1/database/` +
        `${D1_DATABASE_ID}/query`;

    const response =
        await fetch(
            url,
            {
                method: "POST",

                headers:
                {
                    "Authorization":
                        `Bearer ${CLOUDFLARE_API_TOKEN}`,

                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify(
                {
                    sql:
                        "SELECT guild_id, channel_id " +
                        "FROM subscriptions;"
                })
            }
        );

    const body =
        await response.json();

    if (!response.ok || !body.success)
    {
        throw new Error(
            `Failed to query D1: ${JSON.stringify(body.errors)}`
        );
    }

    const queryResult =
        body.result?.[0];

    if (!queryResult?.success)
    {
        throw new Error(
            "D1 query did not complete successfully."
        );
    }

    return queryResult.results ?? [];
}

function sleep(milliseconds)
{
    return new Promise(
        (resolve) =>
        {
            setTimeout(resolve, milliseconds);
        }
    );
}

async function sendDiscordMessage(
    channelId,
    content,
    retryCount = 0
)
{
    const url =
        `https://discord.com/api/v10/channels/` +
        `${channelId}/messages`;

    const response =
        await fetch(
            url,
            {
                method: "POST",

                headers:
                {
                    "Authorization":
                        `Bot ${DISCORD_TOKEN}`,

                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify(
                {
                    content,

                    allowed_mentions:
                    {
                        parse: []
                    }
                })
            }
        );

    if (response.status === 429 && retryCount < 3)
    {
        const rateLimit =
            await response.json();

        const retryAfter =
            Number(rateLimit.retry_after ?? 1);

        console.log(
            `Rate limited. Retrying in ${retryAfter}s.`
        );

        await sleep(
            Math.ceil(retryAfter * 1000)
        );

        return sendDiscordMessage(
            channelId,
            content,
            retryCount + 1
        );
    }

    if (!response.ok)
    {
        const error =
            await response.text();

        throw new Error(
            `Discord returned ${response.status}: ${error}`
        );
    }
}

async function main()
{
    requireEnvironmentVariables();

    const subscriptions =
        await getSubscriptions();

    if (subscriptions.length === 0)
    {
        console.log(
            "No Frontline subscriptions configured."
        );

        return;
    }

    const message =
        buildRotationMessage();

    let successes = 0;
    let failures = 0;

    console.log(
        `Sending Frontline rotation to ` +
        `${subscriptions.length} server(s).`
    );

    for (const subscription of subscriptions)
    {
        try
        {
            await sendDiscordMessage(
                subscription.channel_id,
                message
            );

            successes++;

            console.log(
                `✓ ${subscription.guild_id} -> ` +
                `${subscription.channel_id}`
            );
        }
        catch (error)
        {
            failures++;

            console.error(
                `✗ ${subscription.guild_id} -> ` +
                `${subscription.channel_id}`
            );

            console.error(error);
        }
    }

    console.log(
        `Finished: ${successes} succeeded, ` +
        `${failures} failed.`
    );

    if (failures > 0)
    {
        process.exitCode = 1;
    }
}

main().catch((error) =>
{
    console.error(error);
    process.exit(1);
});