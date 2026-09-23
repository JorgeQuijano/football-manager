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

export const NATIONS: NationDef[] = [
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
      { name: "Northport FC", short: "NOR", color: "#2ED573", city: "Northport", ground: "The Dockside", founded: 1898, honours: 7 },
      { name: "Ironvale United", short: "IRV", color: "#4DABF7", city: "Ironvale", ground: "Forge Park", founded: 1904, honours: 4 },
      { name: "Ashford Town", short: "ASH", color: "#FFB020", city: "Ashford", ground: "Watling Road", founded: 1911, honours: 2 },
      { name: "Westgate Rovers", short: "WGR", color: "#B197FC", city: "Westgate", ground: "The Rovers Bowl", founded: 1922, honours: 1 },
      { name: "Kingsbury AFC", short: "KGB", color: "#FF8787", city: "Kingsbury", ground: "Crown Lane", founded: 1930, honours: 0 },
      { name: "Brackenfield City", short: "BRK", color: "#63E6BE", city: "Brackenfield", ground: "The Heath", founded: 1936, honours: 3 },
      { name: "Stonebridge FC", short: "STB", color: "#FFA94D", city: "Stonebridge", ground: "Bridge End", founded: 1944, honours: 2 },
      { name: "Marlowe Wanderers", short: "MAR", color: "#74C0FC", city: "Marlowe", ground: "Grange Park", founded: 1951, honours: 0 },
      { name: "Redmoor Athletic", short: "RDM", color: "#F783AC", city: "Redmoor", ground: "The Quarry", founded: 1963, honours: 0 },
      { name: "Fairhaven FC", short: "FAI", color: "#C0EB75", city: "Fairhaven", ground: "Seaview", founded: 1970, honours: 0 },
      { name: "Harborough Rangers", short: "HAR", color: "#FFD43B", city: "Harborough", ground: "The Weir", founded: 1921, honours: 2 },
      { name: "Ellesmere City", short: "ELL", color: "#8CE99A", city: "Ellesmere", ground: "Lakeside", founded: 1928, honours: 1 },
      { name: "Cranford Albion", short: "CRA", color: "#A5D8FF", city: "Cranford", ground: "Albion Fields", founded: 1933, honours: 3 },
      { name: "Thornbury Town", short: "THB", color: "#FFC9C9", city: "Thornbury", ground: "The Warren", founded: 1939, honours: 0 },
      { name: "Selby Park", short: "SEL", color: "#D0BFFF", city: "Selby", ground: "Park Lane", founded: 1947, honours: 1 },
      { name: "Glenmoor United", short: "GLN", color: "#FFE066", city: "Glenmoor", ground: "The Bowl", founded: 1954, honours: 0 },
      { name: "Oxbourne FC", short: "OXB", color: "#96F2D7", city: "Oxbourne", ground: "Riverside", founded: 1959, honours: 2 },
      { name: "Radcliffe Wanderers", short: "RAD", color: "#FFB4A2", city: "Radcliffe", ground: "Wanderers Way", founded: 1964, honours: 0 },
      { name: "Wexford Athletic", short: "WEX", color: "#99E9F2", city: "Wexford", ground: "The Harbour", founded: 1968, honours: 0 },
      { name: "Larkspur Town", short: "LRK", color: "#E599F7", city: "Larkspur", ground: "Meadow End", founded: 1974, honours: 0 }
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
      { name: "Real Valdoro", short: "RVD", color: "#F1F3F5", city: "Valdoro", ground: "El Mirador", founded: 1902, honours: 9 },
      { name: "Club Atlético Sierramar", short: "SIE", color: "#FF6B6B", city: "Sierramar", ground: "La Ribera Alta", founded: 1908, honours: 6 },
      { name: "Deportivo Almenara", short: "ALM", color: "#4DABF7", city: "Almenara", ground: "Campo de la Vega", founded: 1912, honours: 4 },
      { name: "Unión Pedralba", short: "PED", color: "#FFD43B", city: "Pedralba", ground: "Estadio del Río", founded: 1915, honours: 3 },
      { name: "Racing Torviscal", short: "TOR", color: "#63E6BE", city: "Torviscal", ground: "El Sardinel", founded: 1919, honours: 2 },
      { name: "CD Miralbueno", short: "MIR", color: "#B197FC", city: "Miralbueno", ground: "Los Almendros", founded: 1923, honours: 2 },
      { name: "Real San Miguel", short: "RSM", color: "#FFA94D", city: "San Miguel", ground: "La Ermita", founded: 1926, honours: 1 },
      { name: "CF Cortijo Nuevo", short: "COR", color: "#8CE99A", city: "Cortijo Nuevo", ground: "El Llano", founded: 1929, honours: 1 },
      { name: "Atlético Oropesa", short: "ORO", color: "#F783AC", city: "Oropesa", ground: "Campo Viejo", founded: 1931, honours: 3 },
      { name: "CD La Ribera", short: "RIB", color: "#74C0FC", city: "La Ribera", ground: "La Isla", founded: 1934, honours: 0 },
      { name: "Unión Villalba", short: "VIL", color: "#FFE066", city: "Villalba", ground: "El Prado", founded: 1937, honours: 1 },
      { name: "Real Punta Verde", short: "PTV", color: "#96F2D7", city: "Punta Verde", ground: "Costa Sur", founded: 1941, honours: 0 },
      { name: "AD Monteclaro", short: "MON", color: "#FFC9C9", city: "Monteclaro", ground: "El Bosque", founded: 1944, honours: 2 },
      { name: "Club Laredo del Mar", short: "LAR", color: "#C0EB75", city: "Laredo del Mar", ground: "La Bahía", founded: 1948, honours: 0 },
      { name: "Deportivo Cañaveral", short: "CAÑ", color: "#E599F7", city: "Cañaveral", ground: "Los Caños", founded: 1952, honours: 1 },
      { name: "Unión Bajo Ebro", short: "BEB", color: "#99E9F2", city: "Bajo Ebro", ground: "El Azud", founded: 1956, honours: 0 },
      { name: "CF Tierras Altas", short: "TIA", color: "#D0BFFF", city: "Tierras Altas", ground: "La Cima", founded: 1961, honours: 0 },
      { name: "Racing Puerto Gris", short: "PGR", color: "#FFB4A2", city: "Puerto Gris", ground: "El Muelle", founded: 1965, honours: 0 },
      { name: "CD Valle Hondo", short: "VLH", color: "#FFD8A8", city: "Valle Hondo", ground: "La Hondonada", founded: 1969, honours: 0 },
      { name: "Atlético Nuevo Sur", short: "NSU", color: "#A5D8FF", city: "Nuevo Sur", ground: "Estadio Nuevo", founded: 1975, honours: 0 }
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
      { name: "SV Hohenstadt", short: "HOH", color: "#FF6B6B", city: "Hohenstadt", ground: "Stadion am Berg", founded: 1900, honours: 10 },
      { name: "FC Neuhafen", short: "NHF", color: "#4DABF7", city: "Neuhafen", ground: "Hafenarena", founded: 1904, honours: 7 },
      { name: "VfL Lindenberg", short: "LIN", color: "#FFD43B", city: "Lindenberg", ground: "Lindenkampfbahn", founded: 1907, honours: 5 },
      { name: "TSV Kaltbrunn", short: "KAL", color: "#63E6BE", city: "Kaltbrunn", ground: "Am Kalten Bach", founded: 1911, honours: 3 },
      { name: "SC Grünfelde", short: "GRÜ", color: "#8CE99A", city: "Grünfelde", ground: "Waldstadion", founded: 1913, honours: 4 },
      { name: "FC Altmoor", short: "ALT", color: "#B197FC", city: "Altmoor", ground: "Moorweide", founded: 1916, honours: 2 },
      { name: "SV Rosenfeld", short: "ROS", color: "#F783AC", city: "Rosenfeld", ground: "Rosenarena", founded: 1919, honours: 1 },
      { name: "VfB Weidenau", short: "WEI", color: "#FFA94D", city: "Weidenau", ground: "Weidenau-Platz", founded: 1922, honours: 2 },
      { name: "TSV Bassendorf", short: "BAS", color: "#74C0FC", city: "Bassendorf", ground: "Bassenkampfbahn", founded: 1925, honours: 0 },
      { name: "SC Feldingen", short: "FEL", color: "#FFE066", city: "Feldingen", ground: "Feldstadion", founded: 1928, honours: 1 },
      { name: "FC Steinbach", short: "STB", color: "#96F2D7", city: "Steinbach", ground: "Steinbruch", founded: 1931, honours: 3 },
      { name: "SV Kirchhagen", short: "KIR", color: "#FFC9C9", city: "Kirchhagen", ground: "An der Kirche", founded: 1934, honours: 0 },
      { name: "VfL Dornheim", short: "DOR", color: "#C0EB75", city: "Dornheim", ground: "Dornenkampf", founded: 1937, honours: 2 },
      { name: "TSV Eichwald", short: "EIC", color: "#E599F7", city: "Eichwald", ground: "Eichenstadion", founded: 1940, honours: 0 },
      { name: "FC Mühlgrund", short: "MÜH", color: "#99E9F2", city: "Mühlgrund", ground: "Mühlenpark", founded: 1946, honours: 1 },
      { name: "SV Nordfelde", short: "NOR", color: "#D0BFFF", city: "Nordfelde", ground: "Nordkurve", founded: 1949, honours: 0 },
      { name: "SC Blankenau", short: "BLA", color: "#FFB4A2", city: "Blankenau", ground: "Blankenberg", founded: 1953, honours: 0 },
      { name: "FC Osthofen", short: "OST", color: "#FFD8A8", city: "Osthofen", ground: "Ostpark", founded: 1958, honours: 0 },
      { name: "VfB Lerchenfeld", short: "LER", color: "#A5D8FF", city: "Lerchenfeld", ground: "Lerchenwiese", founded: 1962, honours: 0 },
      { name: "TSV Sonnenberg", short: "SON", color: "#FFEC99", city: "Sonnenberg", ground: "Sonnenhang", founded: 1968, honours: 0 }
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
      { name: "AC Valcortese", short: "VCO", color: "#FF6B6B", city: "Valcortese", ground: "Stadio del Valle", founded: 1899, honours: 9 },
      { name: "US Monterello", short: "MTR", color: "#4DABF7", city: "Monterello", ground: "Campo Monterello", founded: 1903, honours: 7 },
      { name: "AS Sestobianco", short: "SEB", color: "#F1F3F5", city: "Sestobianco", ground: "Stadio Bianco", founded: 1906, honours: 5 },
      { name: "SS Roccaverde", short: "ROV", color: "#63E6BE", city: "Roccaverde", ground: "La Rocca", founded: 1909, honours: 4 },
      { name: "AC Portanova", short: "PTN", color: "#FFD43B", city: "Portanova", ground: "Stadio del Porto", founded: 1912, honours: 3 },
      { name: "US San Felice", short: "SFE", color: "#B197FC", city: "San Felice", ground: "Campo Felice", founded: 1915, honours: 2 },
      { name: "AS Castelrosso", short: "CSR", color: "#FFA94D", city: "Castelrosso", ground: "Castello Sud", founded: 1918, honours: 2 },
      { name: "Calcio Verteramo", short: "VER", color: "#8CE99A", city: "Verteramo", ground: "Stadio Verteramo", founded: 1921, honours: 1 },
      { name: "SS Lodigiana", short: "LOD", color: "#F783AC", city: "Lodigiana", ground: "Campo Vecchio", founded: 1924, honours: 3 },
      { name: "US Ponteverde", short: "POV", color: "#74C0FC", city: "Ponteverde", ground: "Ponte Nuovo", founded: 1927, honours: 0 },
      { name: "AC Santa Chiara", short: "SCH", color: "#FFE066", city: "Santa Chiara", ground: "Stadio Santa Chiara", founded: 1930, honours: 1 },
      { name: "AS Fiumalba", short: "FAL", color: "#96F2D7", city: "Fiumalba", ground: "Riva del Fiume", founded: 1933, honours: 0 },
      { name: "SS Montegrappa", short: "MGP", color: "#FFC9C9", city: "Montegrappa", ground: "Campo Alto", founded: 1936, honours: 2 },
      { name: "US Terrafuoco", short: "TEF", color: "#C0EB75", city: "Terrafuoco", ground: "Stadio Vulcano", founded: 1940, honours: 0 },
      { name: "AC Bellavista", short: "BLV", color: "#E599F7", city: "Bellavista", ground: "Belvedere", founded: 1944, honours: 1 },
      { name: "AS Corvara Nuova", short: "COR", color: "#99E9F2", city: "Corvara Nuova", ground: "Campo Nuovo", founded: 1949, honours: 0 },
      { name: "US Marecchia", short: "MAR", color: "#D0BFFF", city: "Marecchia", ground: "Stadio dell'Argine", founded: 1953, honours: 0 },
      { name: "SS Poggioalto", short: "PGA", color: "#FFB4A2", city: "Poggioalto", ground: "Poggio", founded: 1957, honours: 0 },
      { name: "AC Vallecupa", short: "VLC", color: "#FFD8A8", city: "Vallecupa", ground: "Campo Cupo", founded: 1961, honours: 0 },
      { name: "US Nuova Tarquinia", short: "NTQ", color: "#A5D8FF", city: "Nuova Tarquinia", ground: "Stadio Nuovo", founded: 1971, honours: 0 }
    ]
  }
];

export const nationById = (id: string): NationDef => NATIONS.find((n) => n.id === id) ?? NATIONS[0];
export const NATION_IDS: NationId[] = NATIONS.map((n) => n.id);

/** The club ids of a nation: the English league keeps its original c1..c20 ids. */
export const clubIdFor = (nation: NationId, index: number): string =>
  nation === "eng" ? `c${index + 1}` : `${nation}-${index + 1}`;

// The English club set is also exported under its historic name so the rest of
// the engine (lore, briefs, old saves) keeps working untouched.
export const CLUB_DEFS = NATIONS[0].clubs.map((c) => ({ name: c.name, short: c.short, color: c.color }));
