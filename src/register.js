const applicationId =
    process.env.DISCORD_APPLICATION_ID;

const guildId =
    process.env.TEST_GUILD_ID;

const token =
    process.env.DISCORD_TOKEN;

if (!applicationId || !guildId || !token)
{
    throw new Error(
        "Missing Discord registration credentials."
    );
}

const command =
{
    name: "frontlines",
    description: "FFXIV Frontline rotation",
    type: 1,

    options:
    [
        {
            type: 1,
            name: "current",
            description:
                "Show the current and next Frontline map"
        },
        {
            type: 1,
            name: "setup",
            description:
                "Send daily Frontline announcements to this channel"
        },
        {
            type: 1,
            name: "disable",
            description:
                "Disable daily Frontline announcements"
        }
    ]
};

const url =
    `https://discord.com/api/v10/applications/` +
    `${applicationId}/guilds/${guildId}/commands`;

const response =
    await fetch(
        url,
        {
            method: "POST",

            headers:
            {
                "Content-Type":
                    "application/json",

                Authorization:
                    `Bot ${token}`
            },

            body:
                JSON.stringify(command)
        }
    );

if (!response.ok)
{
    throw new Error(
        await response.text()
    );
}

console.log(
    "Registered command:",
    await response.json()
);