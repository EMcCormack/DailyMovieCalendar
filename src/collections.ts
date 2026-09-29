import type { Movie, Collection } from "../shared/models";
const movies = (text: string, genre: string): Movie[] =>
  text.split("|").map((item) => {
    const [title, year, tmdbId] = item.split("~");
    const id = Number(tmdbId);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`Missing TMDB ID for ${title}`);
    return { id: `tmdb:${id}`, tmdbId: id, title, year: Number(year), genre };
  });
const christmas = movies(
  "Home Alone~1990~771|Elf~2003~10719|The Holiday~2006~1581|It's a Wonderful Life~1946~1585|Klaus~2019~508965|The Muppet Christmas Carol~1992~10437|The Polar Express~2004~5255|Miracle on 34th Street~1947~11881|Arthur Christmas~2011~51052|How the Grinch Stole Christmas~2000~8871|The Santa Clause~1994~11395|A Christmas Story~1983~850|White Christmas~1954~13368|Scrooged~1988~9647|National Lampoon's Christmas Vacation~1989~5825|Jingle All the Way~1996~9279|Home Alone 2: Lost in New York~1992~772|The Christmas Chronicles~2018~527435|Last Christmas~2019~549053|Love Actually~2003~508|The Bishop's Wife~1947~19490|A Boy Called Christmas~2021~615666|The Family Stone~2005~9043|Noelle~2019~454467|A Christmas Carol~2009~17979",
  "Holiday favorites",
);
const halloween = movies(
  "Hocus Pocus~1993~10439|The Nightmare Before Christmas~1993~9479|Beetlejuice~1988~4011|Coraline~2009~14836|The Addams Family~1991~2907|Practical Magic~1998~6435|Ghostbusters~1984~620|Casper~1995~8839|Edward Scissorhands~1990~162|Sleepy Hollow~1999~2668|The Witches~1990~10166|ParaNorman~2012~77174|Frankenweenie~2012~62214|Monster House~2006~9297|The Haunted Mansion~2003~10756|Halloweentown~1998~27850|Corpse Bride~2005~3933|Gremlins~1984~927|The Others~2001~1933|The Sixth Sense~1999~745|The Craft~1996~9100|Death Becomes Her~1992~9374|Little Shop of Horrors~1986~10776|The Lost Boys~1987~1547|The Mummy~1999~564|Addams Family Values~1993~2758|Hotel Transylvania~2012~76492|Goosebumps~2015~257445|The House with a Clock in Its Walls~2018~463821|The Witches of Eastwick~1987~6069|Hocus Pocus 2~2022~642885",
  "Spooky favorites",
);
const horror = movies(
  "Halloween~1978~948|The Thing~1982~1091|Alien~1979~348|The Shining~1980~694|Get Out~2017~419430|The Conjuring~2013~138843|Scream~1996~4232|Psycho~1960~539|The Exorcist~1973~9552|The Babadook~2014~242224|Hereditary~2018~493922|The Witch~2015~310131|It Follows~2014~270303|A Quiet Place~2018~447332|The Descent~2005~9392|The Ring~2002~565|The Blair Witch Project~1999~2667|The Texas Chain Saw Massacre~1974~30497|Night of the Living Dead~1968~10331|Dawn of the Dead~1978~923|Suspiria~1977~11906|The Evil Dead~1981~764|The Fly~1986~9426|Carrie~1976~7340|Candyman~1992~9529|The Wicker Man~1973~16307|Nosferatu~1922~653|Dracula~1931~138|Frankenstein~1931~3035|The Invisible Man~2020~570670|Trick ’r Treat~2007~23202",
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
