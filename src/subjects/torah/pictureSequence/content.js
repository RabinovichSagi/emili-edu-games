export const TORAH_BOOKS = [
  { id: "bereshit", titleHe: "בראשית", emoji: "🌱" },
  { id: "shemot", titleHe: "שמות", emoji: "🧺" },
  { id: "vayikra", titleHe: "ויקרא", emoji: "🕊️" },
  { id: "bamidbar", titleHe: "במדבר", emoji: "🏕️" },
  { id: "devarim", titleHe: "דברים", emoji: "📜" },
];

export const TORAH_PARASHOT = [
  {
    id: "bereshit",
    bookId: "bereshit",
    titleHe: "בראשית",
    subtitleHe: "סדר ימי הבריאה הראשונים",
    addedAt: 20260529,
    stories: [
      {
        id: "creation_days_1_4",
        titleHe: "ארבעת ימי הבריאה הראשונים",
        promptHe: "סדרו את התמונות לפי הסדר: מה נברא קודם?",
        difficulty: 1,
        minCards: 4,
        itemKey: "bereshit|creation_days_1_4|days_1_4",
        cards: [
          {
            id: "day_1_light",
            order: 1,
            titleHe: "אור וחושך",
            hintHe: "היום הראשון: האור נפרד מן החושך.",
            image: "./public/torah/pictureSequence/bereshit/creation-days-four/day-1-light.svg",
            altHe: "איור רך של אור זהוב וחושך כחול עם כוכבים",
          },
          {
            id: "day_2_sky",
            order: 2,
            titleHe: "רקיע ושמים",
            hintHe: "היום השני: מים למטה ושמים מעל.",
            image: "./public/torah/pictureSequence/bereshit/creation-days-four/day-2-sky.svg",
            altHe: "איור של שמים רכים וגלי מים נעימים",
          },
          {
            id: "day_3_land_plants",
            order: 3,
            titleHe: "יבשה וצמחים",
            hintHe: "היום השלישי: יבשה, ים, עצים ופרחים.",
            image: "./public/torah/pictureSequence/bereshit/creation-days-four/day-3-land-plants.svg",
            altHe: "איור של אי ירוק עם עצים, פרחים וים מסביב",
          },
          {
            id: "day_4_lights",
            order: 4,
            titleHe: "מאורות",
            hintHe: "היום הרביעי: שמש, ירח וכוכבים מאירים.",
            image: "./public/torah/pictureSequence/bereshit/creation-days-four/day-4-lights.svg",
            altHe: "איור של שמש חייכנית, ירח וכוכבים בשמים",
          },
        ],
      },
    ],
  },
];

export function latestParashaId() {
  return [...TORAH_PARASHOT].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))[0]?.id || "";
}

export function getParasha(id) {
  return TORAH_PARASHOT.find((p) => p.id === id) || TORAH_PARASHOT.find((p) => p.id === latestParashaId());
}

export function parashotForBook(bookId) {
  return TORAH_PARASHOT.filter((p) => p.bookId === bookId).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
}
