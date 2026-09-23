/**
 * The world's nations and their leagues (v0.38).
 *
 * Everything country-specific lives here as data: the league's name, its twenty
 * clubs (name, code, colour, city, ground, founding year, honours), the pools the
 * player generator draws names from, and a few phrases the club brief can use.
 *
 * Adding a fifth league is adding a fifth entry to `NATIONS` — no engine code
 * knows how many there are, which country the game is set in, or what a club is
 * called. The English league is first and mirrors the club set the game was
 * originally built on, so existing saves and their lore keep working.
 */

export type NationId = "eng" | "esp" | "ger" | "ita";

/** A club as it is stored: seven fields, no keys — the property names are what
 *  a bundle cannot minify, and eighty clubs is real weight. Decoded immediately. */
export type ClubTuple = [string, string, string, string, string, number, number];

export interface NationClubDef {
  name: string;
  short: string;
  color: string;
  city: string;
  ground: string;
  founded: number;
  honours: number;
}

export interface NationDef {
  id: NationId;
  country: string;
  /** the league's name, as the press would say it */
  league: string;
  first: string[];
  last: string[];
  /** how a club brief talks about a club from here */
  identity: string[];
  clubs: NationClubDef[];
}

const RAW: Array<Omit<NationDef, "clubs"> & { clubs: ClubTuple[] }> = [
  {
    id: "eng",
    country: "England",
    league: "League One",
    identity: [
      "Solid, unfashionable and hard to beat at home — a manager's club.",
      "A restless crowd that remembers better years.",
      "Well run, well coached, quietly in the conversation every spring.",
      "New money and a modern club that expects to be taken seriously.",
      "Small ground, tight budget, a squad that runs through walls."
    ],
    first: [
      "Jack", "Liam", "Owen", "Noah", "Ethan", "Mason", "Leo", "Kai", "Ryan", "Cole",
      "Finn", "Jude", "Milo", "Arlo", "Ezra", "Nico", "Theo", "Luca", "Hugo", "Dean",
      "Reid", "Troy", "Vince", "Joel", "Sam", "Abe", "Rory", "Neil", "Curtis", "Brad",
      "Frank", "Hank", "Isaac", "Miles", "Nate", "Oscar", "Pete", "Quinn", "Rex", "Seth"
    ],
    last: [
      "Mora", "Okafor", "Silva", "Costa", "Baker", "Hayes", "Reed", "Cole", "Shaw", "Mills",
      "Frost", "Nash", "Doyle", "Boyd", "Chambers", "Ellis", "Fletcher", "Grant", "Hale", "Irving",
      "Jennings", "Keller", "Lawson", "Mercer", "Nolan", "Ortiz", "Pike", "Quill", "Rowan", "Sutton",
      "Tate", "Underwood", "Vance", "Walker", "Yates", "Zimmer", "Abbott", "Barrett", "Cannon", "Dalton",
      "Eaton", "Farrell", "Gibson", "Holmes", "Ingram", "Joyce", "Keane", "Lombardi", "Marin", "Novak",
      "Olsen", "Pardo", "Rivas", "Stanton", "Thorne", "Urbina", "Vega", "Walsh", "Whitlock", "Brennan"
    ],
    clubs: [
      ["Northport FC","NOR","#2ED573","Northport","The Dockside",1898,7],
      ["Ironvale United","IRV","#4DABF7","Ironvale","Forge Park",1904,4],
      ["Ashford Town","ASH","#FFB020","Ashford","Watling Road",1911,2],
      ["Westgate Rovers","WGR","#B197FC","Westgate","The Rovers Bowl",1922,1],
      ["Kingsbury AFC","KGB","#FF8787","Kingsbury","Crown Lane",1930,0],
      ["Brackenfield City","BRK","#63E6BE","Brackenfield","The Heath",1936,3],
      ["Stonebridge FC","STB","#FFA94D","Stonebridge","Bridge End",1944,2],
      ["Marlowe Wanderers","MAR","#74C0FC","Marlowe","Grange Park",1951,0],
      ["Redmoor Athletic","RDM","#F783AC","Redmoor","The Quarry",1963,0],
      ["Fairhaven FC","FAI","#C0EB75","Fairhaven","Seaview",1970,0],
      ["Harborough Rangers","HAR","#FFD43B","Harborough","The Weir",1921,2],
      ["Ellesmere City","ELL","#8CE99A","Ellesmere","Lakeside",1928,1],
      ["Cranford Albion","CRA","#A5D8FF","Cranford","Albion Fields",1933,3],
      ["Thornbury Town","THB","#FFC9C9","Thornbury","The Warren",1939,0],
      ["Selby Park","SEL","#D0BFFF","Selby","Park Lane",1947,1],
      ["Glenmoor United","GLN","#FFE066","Glenmoor","The Bowl",1954,0],
      ["Oxbourne FC","OXB","#96F2D7","Oxbourne","Riverside",1959,2],
      ["Radcliffe Wanderers","RAD","#FFB4A2","Radcliffe","Wanderers Way",1964,0],
      ["Wexford Athletic","WEX","#99E9F2","Wexford","The Harbour",1968,0],
      ["Larkspur Town","LRK","#E599F7","Larkspur","Meadow End",1974,0],
    ]
  },
  {
    id: "esp",
    country: "Spain",
    league: "Primera División",
    identity: [
      "A club built on patience: the ball, the pitch, the long afternoon.",
      "Fierce at home, where the stands sit close enough to argue with you.",
      "A youth academy that has produced more than the balance sheet suggests.",
      "Big-city money, big-city pressure, and a president who likes the microphone.",
      "A working town's club, and a squad that runs for it."
    ],
    first: [
      "Mateo", "Álvaro", "Iker", "Sergio", "Javier", "Diego", "Marcos", "Pablo", "Rubén", "Adrián",
      "Hugo", "Iván", "Unai", "Asier", "Bruno", "Nico", "Rodrigo", "Tomás", "Gonzalo", "Andrés",
      "Raúl", "Guillem", "Aitor", "Borja", "Fermín", "Iñaki", "Jorge", "Luis", "Manu", "Óscar",
      "Pau", "Quique", "Santi", "Víctor", "Xavi", "Yago", "Zubiri", "Cristian", "Emilio", "Nacho"
    ],
    last: [
      "García", "Fernández", "Romero", "Navarro", "Iglesias", "Serrano", "Cabrera", "Delgado", "Molina", "Ortega",
      "Peña", "Vargas", "Herrera", "Campos", "Rivas", "Salas", "Ibarra", "Nogueira", "Quintero", "Vidal",
      "Alonso", "Bermejo", "Cordero", "Duarte", "Escobar", "Fuentes", "Gallardo", "Hidalgo", "Izquierdo", "Jimeno",
      "Lara", "Mendoza", "Nieto", "Olmedo", "Pardo", "Quintana", "Redondo", "Sanz", "Trujillo", "Ureña",
      "Valero", "Zamora", "Bustos", "Carrasco", "Domínguez", "Estrada", "Ferrán", "Guzmán", "Lozano", "Marín"
    ],
    clubs: [
      ["Real Valdoro","RVD","#F1F3F5","Valdoro","El Mirador",1902,9],
      ["Club Atlético Sierramar","SIE","#FF6B6B","Sierramar","La Ribera Alta",1908,6],
      ["Deportivo Almenara","ALM","#4DABF7","Almenara","Campo de la Vega",1912,4],
      ["Unión Pedralba","PED","#FFD43B","Pedralba","Estadio del Río",1915,3],
      ["Racing Torviscal","TOR","#63E6BE","Torviscal","El Sardinel",1919,2],
      ["CD Miralbueno","MIR","#B197FC","Miralbueno","Los Almendros",1923,2],
      ["Real San Miguel","RSM","#FFA94D","San Miguel","La Ermita",1926,1],
      ["CF Cortijo Nuevo","COR","#8CE99A","Cortijo Nuevo","El Llano",1929,1],
      ["Atlético Oropesa","ORO","#F783AC","Oropesa","Campo Viejo",1931,3],
      ["CD La Ribera","RIB","#74C0FC","La Ribera","La Isla",1934,0],
      ["Unión Villalba","VIL","#FFE066","Villalba","El Prado",1937,1],
      ["Real Punta Verde","PTV","#96F2D7","Punta Verde","Costa Sur",1941,0],
      ["AD Monteclaro","MON","#FFC9C9","Monteclaro","El Bosque",1944,2],
      ["Club Laredo del Mar","LAR","#C0EB75","Laredo del Mar","La Bahía",1948,0],
      ["Deportivo Cañaveral","CAÑ","#E599F7","Cañaveral","Los Caños",1952,1],
      ["Unión Bajo Ebro","BEB","#99E9F2","Bajo Ebro","El Azud",1956,0],
      ["CF Tierras Altas","TIA","#D0BFFF","Tierras Altas","La Cima",1961,0],
      ["Racing Puerto Gris","PGR","#FFB4A2","Puerto Gris","El Muelle",1965,0],
      ["CD Valle Hondo","VLH","#FFD8A8","Valle Hondo","La Hondonada",1969,0],
      ["Atlético Nuevo Sur","NSU","#A5D8FF","Nuevo Sur","Estadio Nuevo",1975,0],
    ]
  },
  {
    id: "ger",
    country: "Germany",
    league: "Bundesliga Nord",
    identity: [
      "Standing room behind the goal, and a club owned by the people in it.",
      "Training-ground science, a young squad, and a coach who trusts both.",
      "An old industrial name with a ground that still shakes on a Tuesday.",
      "Quietly the best-run club in the league, and it annoys everybody.",
      "A yo-yo club with a fantastic youth setup and a leaking roof."
    ],
    first: [
      "Lukas", "Jonas", "Felix", "Till", "Moritz", "Niklas", "Julius", "Emil", "Anton", "Leon",
      "Tim", "Erik", "Sven", "Matthias", "Fabian", "Philipp", "Sebastian", "Tobias", "Henrik", "Jannik",
      "Maximilian", "Paul", "Rafael", "Simon", "Stefan", "Thomas", "Uwe", "Valentin", "Wendelin", "Arne",
      "Benedikt", "Carlo", "Dominik", "Elias", "Franz", "Gustav", "Hannes", "Ingo", "Jost", "Kilian"
    ],
    last: [
      "Berger", "Hoffmann", "Weber", "Schäfer", "Krüger", "Schmidt", "Bauer", "Winkler", "Hartmann", "Vogt",
      "Kessler", "Brandt", "Eberhardt", "Neumann", "Reuter", "Sturm", "Wenzel", "Adler", "Hahn", "Blum",
      "Falk", "Ritter", "Geiger", "Ziegler", "Albrecht", "Bachmann", "Christ", "Dietrich", "Engel", "Fischer",
      "Gerber", "Huber", "Jäger", "Krause", "Lehmann", "Moser", "Niehaus", "Ostermann", "Pfeiffer", "Roth",
      "Sander", "Trautmann", "Uhlig", "Vogel", "Wagner", "Zimmer", "Bergmann", "Dorn", "Fuchs", "Grimm"
    ],
    clubs: [
      ["SV Hohenstadt","HOH","#FF6B6B","Hohenstadt","Stadion am Berg",1900,10],
      ["FC Neuhafen","NHF","#4DABF7","Neuhafen","Hafenarena",1904,7],
      ["VfL Lindenberg","LIN","#FFD43B","Lindenberg","Lindenkampfbahn",1907,5],
      ["TSV Kaltbrunn","KAL","#63E6BE","Kaltbrunn","Am Kalten Bach",1911,3],
      ["SC Grünfelde","GRÜ","#8CE99A","Grünfelde","Waldstadion",1913,4],
      ["FC Altmoor","ALT","#B197FC","Altmoor","Moorweide",1916,2],
      ["SV Rosenfeld","ROS","#F783AC","Rosenfeld","Rosenarena",1919,1],
      ["VfB Weidenau","WEI","#FFA94D","Weidenau","Weidenau-Platz",1922,2],
      ["TSV Bassendorf","BAS","#74C0FC","Bassendorf","Bassenkampfbahn",1925,0],
      ["SC Feldingen","FEL","#FFE066","Feldingen","Feldstadion",1928,1],
      ["FC Steinbach","STB","#96F2D7","Steinbach","Steinbruch",1931,3],
      ["SV Kirchhagen","KIR","#FFC9C9","Kirchhagen","An der Kirche",1934,0],
      ["VfL Dornheim","DOR","#C0EB75","Dornheim","Dornenkampf",1937,2],
      ["TSV Eichwald","EIC","#E599F7","Eichwald","Eichenstadion",1940,0],
      ["FC Mühlgrund","MÜH","#99E9F2","Mühlgrund","Mühlenpark",1946,1],
      ["SV Nordfelde","NOR","#D0BFFF","Nordfelde","Nordkurve",1949,0],
      ["SC Blankenau","BLA","#FFB4A2","Blankenau","Blankenberg",1953,0],
      ["FC Osthofen","OST","#FFD8A8","Osthofen","Ostpark",1958,0],
      ["VfB Lerchenfeld","LER","#A5D8FF","Lerchenfeld","Lerchenwiese",1962,0],
      ["TSV Sonnenberg","SON","#FFEC99","Sonnenberg","Sonnenhang",1968,0],
    ]
  },
  {
    id: "ita",
    country: "Italy",
    league: "Serie Azzurra",
    identity: [
      "Tactics first: the training ground is where this club wins its points.",
      "A curva that sings for ninety minutes and boos for the other five.",
      "Old money, an old stadium, and a board that expects the title.",
      "A southern club with the loudest away following in the country.",
      "Promoted twice in five years and still playing like it."
    ],
    first: [
      "Marco", "Luca", "Matteo", "Andrea", "Davide", "Simone", "Federico", "Riccardo", "Antonio", "Giuseppe",
      "Pietro", "Tommaso", "Leonardo", "Emanuele", "Nicola", "Gabriele", "Salvatore", "Vittorio", "Fabio", "Mauro",
      "Alessio", "Cristiano", "Daniele", "Enrico", "Filippo", "Gianluca", "Ivan", "Lorenzo", "Michele", "Paolo",
      "Raffaele", "Sergio", "Stefano", "Valerio", "Vincente", "Ettore", "Nicolò", "Samuele", "Giacomo", "Edoardo"
    ],
    last: [
      "Rossi", "Bianchi", "Romano", "Esposito", "Ricci", "Greco", "Conti", "De Luca", "Marino", "Costa",
      "Fontana", "Barbieri", "Santoro", "Marchetti", "Caruso", "Ferrara", "Gallo", "Rizzo", "Lombardi", "Bruno",
      "Amato", "Basile", "Cattaneo", "Donati", "Fabbri", "Gentile", "Grasso", "La Rosa", "Mancini", "Martinelli",
      "Moretti", "Neri", "Orlando", "Palumbo", "Quaranta", "Rinaldi", "Sala", "Testa", "Valente", "Zanetti",
      "Bianco", "Caputo", "D'Amico", "Ferretti", "Giordano", "Leone", "Mazza", "Pellegrini", "Rossetti", "Vitale"
    ],
    clubs: [
      ["AC Valcortese","VCO","#FF6B6B","Valcortese","Stadio del Valle",1899,9],
      ["US Monterello","MTR","#4DABF7","Monterello","Campo Monterello",1903,7],
      ["AS Sestobianco","SEB","#F1F3F5","Sestobianco","Stadio Bianco",1906,5],
      ["SS Roccaverde","ROV","#63E6BE","Roccaverde","La Rocca",1909,4],
      ["AC Portanova","PTN","#FFD43B","Portanova","Stadio del Porto",1912,3],
      ["US San Felice","SFE","#B197FC","San Felice","Campo Felice",1915,2],
      ["AS Castelrosso","CSR","#FFA94D","Castelrosso","Castello Sud",1918,2],
      ["Calcio Verteramo","VER","#8CE99A","Verteramo","Stadio Verteramo",1921,1],
      ["SS Lodigiana","LOD","#F783AC","Lodigiana","Campo Vecchio",1924,3],
      ["US Ponteverde","POV","#74C0FC","Ponteverde","Ponte Nuovo",1927,0],
      ["AC Santa Chiara","SCH","#FFE066","Santa Chiara","Stadio Santa Chiara",1930,1],
      ["AS Fiumalba","FAL","#96F2D7","Fiumalba","Riva del Fiume",1933,0],
      ["SS Montegrappa","MGP","#FFC9C9","Montegrappa","Campo Alto",1936,2],
      ["US Terrafuoco","TEF","#C0EB75","Terrafuoco","Stadio Vulcano",1940,0],
      ["AC Bellavista","BLV","#E599F7","Bellavista","Belvedere",1944,1],
      ["AS Corvara Nuova","COR","#99E9F2","Corvara Nuova","Campo Nuovo",1949,0],
      ["US Marecchia","MAR","#D0BFFF","Marecchia","Stadio dell'Argine",1953,0],
      ["SS Poggioalto","PGA","#FFB4A2","Poggioalto","Poggio",1957,0],
      ["AC Vallecupa","VLC","#FFD8A8","Vallecupa","Campo Cupo",1961,0],
      ["US Nuova Tarquinia","NTQ","#A5D8FF","Nuova Tarquinia","Stadio Nuovo",1971,0],
    ]
  }
];

const decodeClub = (t: ClubTuple): NationClubDef => ({
  name: t[0],
  short: t[1],
  color: t[2],
  city: t[3],
  ground: t[4],
  founded: t[5],
  honours: t[6]
});

export const NATIONS: NationDef[] = RAW.map((n) => ({ ...n, clubs: n.clubs.map(decodeClub) }));

export const nationById = (id: string): NationDef => NATIONS.find((n) => n.id === id) ?? NATIONS[0];

/** The club ids of a nation: the English league keeps its original c1..c20 ids. */
export const clubIdFor = (nation: NationId, index: number): string =>
  nation === "eng" ? `c${index + 1}` : `${nation}-${index + 1}`;

// The English club set is also exported under its historic name so the rest of
// the engine (lore, briefs, old saves) keeps working untouched.
export const CLUB_DEFS = NATIONS[0].clubs.map((c) => ({ name: c.name, short: c.short, color: c.color }));
