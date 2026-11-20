// Big 3D stickers for the Texting style, from Microsoft's Fluent Emoji (MIT, see
// assets/stickers/FLUENT-EMOJI-LICENSE.txt). Bundled, nothing is fetched at runtime.
import airplane from "../../assets/stickers/airplane.webp";
import automobile from "../../assets/stickers/automobile.webp";
import balloon from "../../assets/stickers/balloon.webp";
import bouquet from "../../assets/stickers/bouquet.webp";
import brokenHeart from "../../assets/stickers/broken_heart.webp";
import butterfly from "../../assets/stickers/butterfly.webp";
import catFace from "../../assets/stickers/cat_face.webp";
import cherryBlossom from "../../assets/stickers/cherry_blossom.webp";
import cloudRain from "../../assets/stickers/cloud_with_rain.webp";
import collision from "../../assets/stickers/collision.webp";
import crescentMoon from "../../assets/stickers/crescent_moon.webp";
import crown from "../../assets/stickers/crown.webp";
import crying from "../../assets/stickers/loudly_crying_face.webp";
import dogFace from "../../assets/stickers/dog_face.webp";
import dove from "../../assets/stickers/dove.webp";
import eyes from "../../assets/stickers/eyes.webp";
import fire from "../../assets/stickers/fire.webp";
import gem from "../../assets/stickers/gem_stone.webp";
import ghost from "../../assets/stickers/ghost.webp";
import gift from "../../assets/stickers/wrapped_gift.webp";
import globe from "../../assets/stickers/globe_showing_americas.webp";
import glowingStar from "../../assets/stickers/glowing_star.webp";
import halo from "../../assets/stickers/smiling_face_with_halo.webp";
import heartEyes from "../../assets/stickers/smiling_face_with_hearts.webp";
import horns from "../../assets/stickers/smiling_face_with_horns.webp";
import hotBeverage from "../../assets/stickers/hot_beverage.webp";
import hourglass from "../../assets/stickers/hourglass_done.webp";
import house from "../../assets/stickers/house.webp";
import key from "../../assets/stickers/key.webp";
import kiss from "../../assets/stickers/kiss_mark.webp";
import lipstick from "../../assets/stickers/lipstick.webp";
import mirrorBall from "../../assets/stickers/mirror_ball.webp";
import money from "../../assets/stickers/money_with_wings.webp";
import musicalNotes from "../../assets/stickers/musical_notes.webp";
import partyPopper from "../../assets/stickers/party_popper.webp";
import phone from "../../assets/stickers/mobile_phone.webp";
import rainbow from "../../assets/stickers/rainbow.webp";
import redHeart from "../../assets/stickers/red_heart.webp";
import ring from "../../assets/stickers/ring.webp";
import rocket from "../../assets/stickers/rocket.webp";
import rose from "../../assets/stickers/rose.webp";
import skull from "../../assets/stickers/skull.webp";
import snowflake from "../../assets/stickers/snowflake.webp";
import sparkles from "../../assets/stickers/sparkles.webp";
import sun from "../../assets/stickers/sun.webp";
import tulip from "../../assets/stickers/tulip.webp";
import voltage from "../../assets/stickers/high_voltage.webp";
import wave from "../../assets/stickers/water_wave.webp";
import wine from "../../assets/stickers/wine_glass.webp";
import zzz from "../../assets/stickers/zzz.webp";
import bomb from "../../assets/stickers/bomb.webp";
import cactus from "../../assets/stickers/cactus.webp";
import dagger from "../../assets/stickers/dagger.webp";
import island from "../../assets/stickers/desert_island.webp";
import evergreen from "../../assets/stickers/evergreen_tree.webp";
import herb from "../../assets/stickers/herb.webp";
import motorway from "../../assets/stickers/motorway.webp";
import mountain from "../../assets/stickers/mountain.webp";
import palm from "../../assets/stickers/palm_tree.webp";
import planet from "../../assets/stickers/ringed_planet.webp";
import pottedPlant from "../../assets/stickers/potted_plant.webp";
import seedling from "../../assets/stickers/seedling.webp";
import swords from "../../assets/stickers/crossed_swords.webp";
import tree from "../../assets/stickers/deciduous_tree.webp";
import volcano from "../../assets/stickers/volcano.webp";
import waterPistol from "../../assets/stickers/water_pistol.webp";

/** How a sticker keeps moving once it lands, so it reads like a little GIF. */
export type StickerMotion = "beat" | "flicker" | "float" | "spin" | "wiggle" | "drive" | "sway" | "pulse";

export interface StickerDef {
  id: string;
  url: string;
  motion: StickerMotion;
  /** Whole words that call this sticker up. */
  words: string[];
}

export const STICKERS: StickerDef[] = [
  { id: "house", url: house, motion: "wiggle", words: ["house", "home", "homes", "homeward", "hometown"] },
  { id: "car", url: automobile, motion: "drive", words: ["car", "cars", "drive", "driving", "drove", "ride", "riding"] },
  { id: "flower", url: tulip, motion: "sway", words: ["flower", "flowers", "bloom", "blooming", "garden", "petal", "petals"] },
  { id: "rose", url: rose, motion: "sway", words: ["rose", "roses"] },
  { id: "bouquet", url: bouquet, motion: "sway", words: ["bouquet", "valentine"] },
  { id: "blossom", url: cherryBlossom, motion: "spin", words: ["blossom", "blossoms", "spring"] },
  { id: "heart", url: redHeart, motion: "beat", words: ["love", "loving", "lover", "lovers", "heart", "hearts"] },
  { id: "broken", url: brokenHeart, motion: "wiggle", words: ["heartbreak", "heartbroken", "broken", "shattered"] },
  { id: "fire", url: fire, motion: "flicker", words: ["fire", "flame", "flames", "burn", "burning", "burned", "burnt", "blaze", "hot"] },
  { id: "moon", url: crescentMoon, motion: "float", words: ["moon", "moonlight", "midnight", "tonight", "night", "nights"] },
  { id: "sun", url: sun, motion: "spin", words: ["sun", "sunshine", "sunlight", "sunrise", "sunset", "summer", "daylight"] },
  { id: "star", url: glowingStar, motion: "pulse", words: ["star", "stars", "starlight", "shine", "shining", "galaxy"] },
  { id: "rain", url: cloudRain, motion: "float", words: ["rain", "raining", "rainy", "storm", "storms", "thunder", "clouds"] },
  { id: "snow", url: snowflake, motion: "spin", words: ["snow", "snowing", "winter", "freezing", "frozen", "ice", "cold"] },
  { id: "money", url: money, motion: "float", words: ["money", "cash", "dollar", "dollars", "rich", "paid", "pay", "bills", "racks"] },
  { id: "phone", url: phone, motion: "wiggle", words: ["phone", "call", "calling", "called", "text", "texts", "texting", "ring", "ringing", "dial"] },
  { id: "music", url: musicalNotes, motion: "sway", words: ["song", "songs", "music", "melody", "sing", "singing", "radio", "tune", "beat"] },
  { id: "crown", url: crown, motion: "pulse", words: ["king", "queen", "crown", "throne", "royal"] },
  { id: "eyes", url: eyes, motion: "wiggle", words: ["eyes", "see", "seeing", "look", "looking", "watch", "watching", "stare", "staring"] },
  { id: "cry", url: crying, motion: "wiggle", words: ["cry", "crying", "cried", "tears", "tear", "weep", "sobbing"] },
  { id: "kiss", url: kiss, motion: "beat", words: ["kiss", "kisses", "kissing", "kissed", "lips"] },
  { id: "lipstick", url: lipstick, motion: "sway", words: ["lipstick", "makeup", "pretty", "gorgeous"] },
  { id: "skull", url: skull, motion: "wiggle", words: ["dead", "die", "dying", "death", "kill", "killing", "grave", "bones"] },
  { id: "ghost", url: ghost, motion: "float", words: ["ghost", "ghosts", "ghosted", "haunt", "haunted", "haunting", "spirit"] },
  { id: "devil", url: horns, motion: "wiggle", words: ["devil", "hell", "sin", "sinner", "demon", "demons", "wicked", "evil"] },
  { id: "angel", url: halo, motion: "float", words: ["angel", "angels", "heaven", "halo", "holy", "pray", "praying"] },
  { id: "plane", url: airplane, motion: "drive", words: ["fly", "flying", "flight", "plane", "airport", "sky", "skies"] },
  { id: "wave", url: wave, motion: "sway", words: ["ocean", "oceans", "sea", "seas", "wave", "waves", "tide", "beach", "shore", "drown", "drowning", "water", "river"] },
  { id: "wine", url: wine, motion: "sway", words: ["wine", "drunk", "drink", "drinking", "champagne", "whiskey", "toast", "bottle"] },
  { id: "party", url: partyPopper, motion: "wiggle", words: ["party", "celebrate", "celebration", "birthday"] },
  { id: "voltage", url: voltage, motion: "flicker", words: ["electric", "lightning", "shock", "energy", "power"] },
  { id: "gem", url: gem, motion: "spin", words: ["diamond", "diamonds", "gem", "jewel", "gold", "golden"] },
  { id: "rainbow", url: rainbow, motion: "float", words: ["rainbow", "rainbows", "colors", "colours"] },
  { id: "hourglass", url: hourglass, motion: "wiggle", words: ["time", "clock", "forever", "waiting", "wait", "minutes", "hours", "tick"] },
  { id: "key", url: key, motion: "wiggle", words: ["key", "keys", "lock", "locked", "unlock", "door"] },
  { id: "gift", url: gift, motion: "beat", words: ["gift", "gifts", "present", "presents", "surprise"] },
  { id: "disco", url: mirrorBall, motion: "spin", words: ["dance", "dancing", "danced", "club", "disco", "floor"] },
  { id: "globe", url: globe, motion: "spin", words: ["world", "earth", "globe", "everywhere"] },
  { id: "dog", url: dogFace, motion: "wiggle", words: ["dog", "dogs", "puppy", "pup"] },
  { id: "cat", url: catFace, motion: "wiggle", words: ["cat", "cats", "kitty", "kitten"] },
  { id: "dove", url: dove, motion: "float", words: ["bird", "birds", "dove", "wings", "peace", "free", "freedom"] },
  { id: "butterfly", url: butterfly, motion: "float", words: ["butterfly", "butterflies"] },
  { id: "coffee", url: hotBeverage, motion: "float", words: ["coffee", "tea", "morning", "mornings"] },
  { id: "balloon", url: balloon, motion: "float", words: ["balloon", "balloons", "float", "floating", "high"] },
  { id: "sleep", url: zzz, motion: "float", words: ["sleep", "sleeping", "asleep", "dream", "dreams", "dreaming", "tired", "bed"] },
  { id: "boom", url: collision, motion: "pulse", words: ["boom", "bang", "explode", "explosion", "crash", "blow"] },
  { id: "rocket", url: rocket, motion: "drive", words: ["rocket", "space", "launch", "moonshot", "astronaut"] },
  { id: "smitten", url: heartEyes, motion: "beat", words: ["crush", "adore", "smitten", "darling", "honey", "sweetheart"] },
  { id: "sparkles", url: sparkles, motion: "pulse", words: ["magic", "sparkle", "sparkling", "glitter", "glow", "glowing"] },
  { id: "ring", url: ring, motion: "spin", words: ["marry", "married", "wedding", "proposal", "engaged", "vows"] },
  { id: "gun", url: waterPistol, motion: "wiggle", words: ["gun", "guns", "shotgun", "shotguns", "pistol", "glock", "rifle", "bullet", "bullets", "trigger", "shoot", "shooting", "shooter", "shot", "shots", "pew"] },
  { id: "dagger", url: dagger, motion: "wiggle", words: ["knife", "knives", "blade", "blades", "dagger", "stab", "stabbed"] },
  { id: "swords", url: swords, motion: "pulse", words: ["sword", "swords", "fight", "fighting", "battle", "war", "warrior", "warriors", "soldier"] },
  { id: "bomb", url: bomb, motion: "wiggle", words: ["bomb", "bombs", "grenade", "dynamite", "tnt"] },
  { id: "planet", url: planet, motion: "spin", words: ["planet", "planets", "saturn", "universe", "orbit", "cosmos", "stratosphere"] },
  { id: "road", url: motorway, motion: "drive", words: ["road", "roads", "highway", "highways", "freeway", "street", "streets", "miles", "journey"] },
  { id: "mountain", url: mountain, motion: "pulse", words: ["mountain", "mountains", "hill", "hills", "climb", "climbing", "peak", "summit", "valley"] },
  { id: "tree", url: tree, motion: "sway", words: ["tree", "trees", "forest", "forests", "woods", "branches", "roots", "autumn"] },
  { id: "pine", url: evergreen, motion: "sway", words: ["pine", "pines", "christmas", "evergreen"] },
  { id: "palm", url: palm, motion: "sway", words: ["palm", "palms", "tropical", "vacation", "holiday"] },
  { id: "plant", url: pottedPlant, motion: "sway", words: ["plant", "plants", "houseplant"] },
  { id: "seedling", url: seedling, motion: "sway", words: ["seed", "seeds", "grow", "growing", "grown", "sprout"] },
  { id: "leaf", url: herb, motion: "sway", words: ["leaf", "leaves", "grass", "green", "weed", "nature"] },
  { id: "island", url: island, motion: "float", words: ["island", "islands", "paradise", "castaway"] },
  { id: "volcano", url: volcano, motion: "pulse", words: ["volcano", "lava", "erupt", "eruption", "magma"] },
  { id: "cactus", url: cactus, motion: "wiggle", words: ["cactus", "desert", "deserts", "dry"] },
];

const BY_WORD = new Map<string, number>();
STICKERS.forEach((s, i) => s.words.forEach((w) => BY_WORD.has(w) || BY_WORD.set(w, i)));

const normalise = (word: string) => word.toLowerCase().replace(/[’']/g, "'").replace(/^[^a-z]+|[^a-z]+$/g, "");

/**
 * Finds the first word in a line that has a sticker. Returns the sticker index and the
 * position of the word, so the sticker can land the moment that word is sung.
 */
export function findSticker(words: string[], skip: ReadonlySet<number> = new Set()): { sticker: number; word: number } | null {
  for (let i = 0; i < words.length; i++) {
    const hit = BY_WORD.get(normalise(words[i]!));
    if (hit !== undefined && !skip.has(hit)) return { sticker: hit, word: i };
  }
  return null;
}
