const cards = [
  {
    name: "The Fool",
    filename: "00-TheFool.png",
  },
  {
    name: "The Magician",
    filename: "01-TheMagician.png",
  },
  {
    name: "The High Priestess",
    filename: "02-TheHighPriestess.png",
  },
  {
    name: "The Empress",
    filename: "03-TheEmpress.png",
  },
  {
    name: "The Emperor",
    filename: "04-TheEmperor.png",
  },
  {
    name: "The Hierophant",
    filename: "05-TheHierophant.png",
  },
  {
    name: "The Lovers",
    filename: "06-TheLovers.png",
  },
  {
    name: "The Chariot",
    filename: "07-TheChariot.png",
  },
  {
    name: "Strength",
    filename: "08-Strength.png",
  },
  {
    name: "The Hermit",
    filename: "09-TheHermit.png",
  },
  {
    name: "Wheel of Fortune",
    filename: "10-WheelOfFortune.png",
  },
  {
    name: "Justice",
    filename: "11-Justice.png",
  },
  {
    name: "The Hanged Man",
    filename: "12-TheHangedMan.png",
  },
  {
    name: "Death",
    filename: "13-Death.png",
  },
  {
    name: "Temperance",
    filename: "14-Temperance.png",
  },
  {
    name: "The Devil",
    filename: "15-TheDevil.png",
  },
  {
    name: "The Tower",
    filename: "16-TheTower.png",
  },
  {
    name: "The Star",
    filename: "17-TheStar.png",
  },
  {
    name: "The Moon",
    filename: "18-TheMoon.png",
  },
  {
    name: "The Sun",
    filename: "19-TheSun.png",
  },
  {
    name: "Judgement",
    filename: "20-Judgement.png",
  },
  {
    name: "The World",
    filename: "21-TheWorld.png",
  },
  {
    name: "Ace of Cups",
    filename: "Cups01.png",
  },
  {
    name: "Two of Cups",
    filename: "Cups02.png",
  },
  {
    name: "Three of Cups",
    filename: "Cups03.png",
  },
  {
    name: "Four of Cups",
    filename: "Cups04.png",
  },
  {
    name: "Five of Cups",
    filename: "Cups05.png",
  },
  {
    name: "Six of Cups",
    filename: "Cups06.png",
  },
  {
    name: "Seven of Cups",
    filename: "Cups07.png",
  },
  {
    name: "Eight of Cups",
    filename: "Cups08.png",
  },
  {
    name: "Nine of Cups",
    filename: "Cups09.png",
  },
  {
    name: "Ten of Cups",
    filename: "Cups10.png",
  },
  {
    name: "Page of Cups",
    filename: "Cups11.png",
  },
  {
    name: "Knight of Cups",
    filename: "Cups12.png",
  },
  {
    name: "Queen of Cups",
    filename: "Cups13.png",
  },
  {
    name: "King of Cups",
    filename: "Cups14.png",
  },
  {
    name: "Ace of Pentacles",
    filename: "Pentacles01.png",
  },
  {
    name: "Two of Pentacles",
    filename: "Pentacles02.png",
  },
  {
    name: "Three of Pentacles",
    filename: "Pentacles03.png",
  },
  {
    name: "Four of Pentacles",
    filename: "Pentacles04.png",
  },
  {
    name: "Five of Pentacles",
    filename: "Pentacles05.png",
  },
  {
    name: "Six of Pentacles",
    filename: "Pentacles06.png",
  },
  {
    name: "Seven of Pentacles",
    filename: "Pentacles07.png",
  },
  {
    name: "Eight of Pentacles",
    filename: "Pentacles08.png",
  },
  {
    name: "Nine of Pentacles",
    filename: "Pentacles09.png",
  },
  {
    name: "Ten of Pentacles",
    filename: "Pentacles10.png",
  },
  {
    name: "Page of Pentacles",
    filename: "Pentacles11.png",
  },
  {
    name: "Knight of Pentacles",
    filename: "Pentacles12.png",
  },
  {
    name: "Queen of Pentacles",
    filename: "Pentacles13.png",
  },
  {
    name: "King of Pentacles",
    filename: "Pentacles14.png",
  },
  {
    name: "Ace of Swords",
    filename: "Swords01.png",
  },
  {
    name: "Two of Swords",
    filename: "Swords02.png",
  },
  {
    name: "Three of Swords",
    filename: "Swords03.png",
  },
  {
    name: "Four of Swords",
    filename: "Swords04.png",
  },
  {
    name: "Five of Swords",
    filename: "Swords05.png",
  },
  {
    name: "Six of Swords",
    filename: "Swords06.png",
  },
  {
    name: "Seven of Swords",
    filename: "Swords07.png",
  },
  {
    name: "Eight of Swords",
    filename: "Swords08.png",
  },
  {
    name: "Nine of Swords",
    filename: "Swords09.png",
  },
  {
    name: "Ten of Swords",
    filename: "Swords10.png",
  },
  {
    name: "Page of Swords",
    filename: "Swords11.png",
  },
  {
    name: "Knight of Swords",
    filename: "Swords12.png",
  },
  {
    name: "Queen of Swords",
    filename: "Swords13.png",
  },
  {
    name: "King of Swords",
    filename: "Swords14.png",
  },
  {
    name: "Ace of Wands",
    filename: "Wands01.png",
  },
  {
    name: "Two of Wands",
    filename: "Wands02.png",
  },
  {
    name: "Three of Wands",
    filename: "Wands03.png",
  },
  {
    name: "Four of Wands",
    filename: "Wands04.png",
  },
  {
    name: "Five of Wands",
    filename: "Wands05.png",
  },
  {
    name: "Six of Wands",
    filename: "Wands06.png",
  },
  {
    name: "Seven of Wands",
    filename: "Wands07.png",
  },
  {
    name: "Eight of Wands",
    filename: "Wands08.png",
  },
  {
    name: "Nine of Wands",
    filename: "Wands09.png",
  },
  {
    name: "Ten of Wands",
    filename: "Wands10.png",
  },
  {
    name: "Page of Wands",
    filename: "Wands11.png",
  },
  {
    name: "Knight of Wands",
    filename: "Wands12.png",
  },
  {
    name: "Queen of Wands",
    filename: "Wands13.png",
  },
  {
    name: "King of Wands",
    filename: "Wands14.png",
  },
];

module.exports = { cards };
