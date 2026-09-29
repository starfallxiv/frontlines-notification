const FRONTLINE_MAPS =
[
    "seize",
    "secure",
    "naadam",
    "triumph",
    "seize",
    "shatter",
    "naadam",
    "triumph"
];

const MAP_NAMES =
{
    secure: "Secure Ruins (Secure)",
    seize: "Seal Rock (Seize)",
    shatter: "The Fields of Glory (Shatter)",
    naadam: "Onsal Hakair (Danshig Naadam)",
    triumph: "Worqor Chirteh (Triumph)"
};

const FRONTLINE_REFERENCE_DATE =
    new Date("2026-04-27T15:00:00Z");

const ROTATION_MS =
    24 * 60 * 60 * 1000;

export function getFrontlineRotation(now = new Date())
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

export function buildRotationMessage(now = new Date())
{
    const rotation =
        getFrontlineRotation(now);

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