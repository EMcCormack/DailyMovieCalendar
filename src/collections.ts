import type { Movie, Collection } from "../shared/models";
const movies = (text: string, genre: string): Movie[] =>
  text.split("|").map((item) => {
    const [title, year] = item.split("~");
    return { id: `${title}-${year}`, title, year: Number(year), genre };
  });
const christmas = movies(
  "Home Alone~1990|Elf~2003|The Holiday~2006|It's a Wonderful Life~1946|Klaus~2019|The Muppet Christmas Carol~1992|The Polar Express~2004|Miracle on 34th Street~1947|Arthur Christmas~2011|How the Grinch Stole Christmas~2000|The Santa Clause~1994|A Christmas Story~1983|White Christmas~1954|Scrooged~1988|National Lampoon's Christmas Vacation~1989|Jingle All the Way~1996|Home Alone 2: Lost in New York~1992|The Christmas Chronicles~2018|Last Christmas~2019|Love Actually~2003|The Bishop's Wife~1947|A Boy Called Christmas~2021|The Family Stone~2005|Noelle~2019|A Christmas Carol~2009",
  "Holiday favorites",
);
const halloween = movies(
  "Hocus Pocus~1993|The Nightmare Before Christmas~1993|Beetlejuice~1988|Coraline~2009|The Addams Family~1991|Practical Magic~1998|Ghostbusters~1984|Casper~1995|Edward Scissorhands~1990|Sleepy Hollow~1999|The Witches~1990|ParaNorman~2012|Frankenweenie~2012|Monster House~2006|The Haunted Mansion~2003|Halloweentown~1998|Corpse Bride~2005|Gremlins~1984|The Others~2001|The Sixth Sense~1999|The Craft~1996|Death Becomes Her~1992|Little Shop of Horrors~1986|The Lost Boys~1987|The Mummy~1999|Addams Family Values~1993|Hotel Transylvania~2012|Goosebumps~2015|The House with a Clock in Its Walls~2018|The Witches of Eastwick~1987|Hocus Pocus 2~2022",
  "Spooky favorites",
);
const horror = movies(
  "Halloween~1978|The Thing~1982|Alien~1979|The Shining~1980|Get Out~2017|The Conjuring~2013|Scream~1996|Psycho~1960|The Exorcist~1973|The Babadook~2014|Hereditary~2018|The Witch~2015|It Follows~2014|A Quiet Place~2018|The Descent~2005|The Ring~2002|The Blair Witch Project~1999|The Texas Chain Saw Massacre~1974|Night of the Living Dead~1968|Dawn of the Dead~1978|Suspiria~1977|The Evil Dead~1981|The Fly~1986|Carrie~1976|Candyman~1992|The Wicker Man~1973|Nosferatu~1922|Dracula~1931|Frankenstein~1931|The Invisible Man~2020|Trick ’r Treat~2007",
  "Horror",
);
export const collections: Collection[] = [
  {
    id: "cozy",
    name: "A very cozy Christmas",
    season: "christmas",
    description: "Comfort classics, snowy evenings, and a little holiday magic.",
    badge: "THE CROWD PLEASER",
    emoji: "🏡",
    movies: christmas,
    color: "#e7ebdf",
  },
  {
    id: "spooky",
    name: "Spooky, not sleepless",
    season: "halloween",
    description: "Witches, friendly ghosts, and wonderfully strange adventures.",
    badge: "A LITTLE SPOOKY",
    emoji: "🎃",
    movies: halloween,
    color: "#f2e3d6",
  },
  {
    id: "horror",
    name: "31 nights of fright",
    season: "halloween",
    description: "An after-dark marathon for the brave. Mature audiences.",
    badge: "LIGHTS OFF",
    emoji: "🌙",
    movies: horror,
    color: "#e4e0ed",
  },
  {
    id: "classics",
    name: "Christmas, the classics",
    season: "christmas",
    description: "Start with the golden age, then revisit modern favorites.",
    badge: "TIMELESS FAVORITES",
    emoji: "🎞️",
    movies: [...christmas].sort((a, b) => a.year - b.year),
    color: "#eee5d8",
  },
];
