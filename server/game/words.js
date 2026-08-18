const WORDS = [
  // 🐶 Animals
  "cat",
  "dog",
  "elephant",
  "giraffe",
  "lion",
  "tiger",
  "monkey",
  "rabbit",
  "snake",
  "frog",
  "turtle",
  "shark",
  "whale",
  "dolphin",
  "crocodile",
  "zebra",
  "penguin",
  "owl",
  "parrot",
  "butterfly",
  "bee",
  "spider",
  "snail",
  "crab",

  // 🍕 Food
  "pizza",
  "burger",
  "ice cream",
  "donut",
  "cake",
  "popcorn",
  "watermelon",
  "banana",
  "apple",
  "pineapple",
  "strawberry",
  "hot dog",
  "sandwich",
  "taco",
  "fries",
  "chocolate",
  "cookie",
  "cupcake",
  "lollipop",
  "egg",
  "cheese",
  "noodles",

  // 🏠 Everyday objects
  "chair",
  "table",
  "bed",
  "door",
  "window",
  "lamp",
  "mirror",
  "clock",
  "key",
  "lock",
  "umbrella",
  "backpack",
  "glasses",
  "camera",
  "phone",
  "television",
  "laptop",
  "headphones",
  "toothbrush",
  "toilet",
  "fan",
  "refrigerator",
  "candle",
  "balloon",

  // 🚗 Vehicles
  "car",
  "bus",
  "train",
  "bicycle",
  "motorcycle",
  "airplane",
  "helicopter",
  "boat",
  "ship",
  "submarine",
  "rocket",
  "tractor",
  "ambulance",
  "fire truck",
  "taxi",
  "scooter",
  "skateboard",

  // 🌳 Nature
  "tree",
  "flower",
  "sun",
  "moon",
  "star",
  "cloud",
  "rain",
  "snow",
  "rainbow",
  "volcano",
  "mountain",
  "island",
  "river",
  "waterfall",
  "desert",
  "cactus",
  "palm tree",
  "snowman",
  "lightning",
  "tornado",

  // 👨‍🚀 People & professions
  "doctor",
  "chef",
  "teacher",
  "police officer",
  "firefighter",
  "astronaut",
  "pirate",
  "king",
  "queen",
  "wizard",
  "superhero",
  "cowboy",
  "detective",
  "ninja",
  "clown",
  "farmer",
  "soldier",
  "artist",
  "singer",
  "guitarist",

  // ⚽ Sports & activities
  "football",
  "cricket",
  "basketball",
  "tennis",
  "baseball",
  "volleyball",
  "golf",
  "swimming",
  "running",
  "cycling",
  "skating",
  "surfing",
  "fishing",
  "camping",
  "dancing",
  "singing",
  "reading",
  "cooking",
  "sleeping",
  "jumping",

  // 🏰 Places & things
  "castle",
  "house",
  "school",
  "hospital",
  "library",
  "restaurant",
  "supermarket",
  "airport",
  "beach",
  "park",
  "zoo",
  "museum",
  "lighthouse",
  "tent",
  "bridge",
  "pyramid",
  "spaceship",

  // 🧙 Fun / fantasy
  "dragon",
  "unicorn",
  "mermaid",
  "ghost",
  "vampire",
  "zombie",
  "alien",
  "robot",
  "monster",
  "fairy",
  "witch",
  "treasure",
  "magic wand",
  "sword",
  "crown",
  "pirate ship",

  // 😂 Funny / chaotic
  "toilet paper",
  // "banana peel",
  // "broken phone",
  // "sleepy cat",
  // "fat penguin",
  // "flying pig",
  // "angry chicken",
  // "dancing robot",
  // "crying baby",
  // "giant burger",
  // "tiny elephant",
  // "flying pizza",
  // "monster truck",
  "sock",
  "mustache",
  "skull",
  "ghost",
  "poop",

  // 🧠 Slightly harder
  // "magnet",
  // "compass",
  // "hourglass",
  // "telescope",
  // "microscope",
  // "thermometer",
  // "binoculars",
  // "treasure map",
  // "traffic light",
  // "parking lot",
  // "elevator",
  // "traffic jam",
  // "alarm clock",
  // "remote control",
  // "washing machine",
  // "shopping cart",
  // "roller coaster",
  // "campfire",
  // "kite",
  // "snow globe",
];

function pickWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

/**
 * Pick `count` unique word options, excluding words in `usedWords`.
 * If fewer than `count` unused words remain, signals that the used pool
 * should be reset before recording the eventual choice.
 *
 * @param {string[]} usedWords
 * @param {number} [count=3]
 * @returns {{ options: string[]; shouldResetUsedPool: boolean }}
 */
function pickWordOptions(usedWords, count = 3) {
  const pickUnique = (pool, n) => {
    const copy = [...pool];
    const result = [];
    while (result.length < n && copy.length > 0) {
      const idx = Math.floor(Math.random() * copy.length);
      result.push(copy.splice(idx, 1)[0]);
    }
    return result;
  };

  let available = WORDS.filter((w) => !usedWords.includes(w));
  let shouldResetUsedPool = false;

  if (available.length < count) {
    shouldResetUsedPool = true;
    available = [...WORDS];
  }

  return {
    options: pickUnique(available, count),
    shouldResetUsedPool,
  };
}

module.exports = {
  WORDS,
  pickWord,
  pickWordOptions,
};
