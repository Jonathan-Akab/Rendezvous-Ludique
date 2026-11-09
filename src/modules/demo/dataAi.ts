// Rules AI content of the public demo: sample conversations and FAQ entries (made up).

type Lang = "fr" | "en";
const pick = (lang: Lang, fr: string, en: string) => (lang === "fr" ? fr : en);

export type DemoTurn = { q: string; a: string; pages: number[]; fromFaq?: boolean };
export type DemoChat = { id: string; gameId: string; game: string; title: string; hoursAgo: number; rulebooks: number; turns: DemoTurn[] };

export function demoAiChats(lang: Lang): DemoChat[] {
  return [
    {
      id: "c-catan",
      gameId: "g-catan",
      game: "Catan",
      title: pick(lang, "Échanges avec la banque", "Trading with the bank"),
      hoursAgo: 2,
      rulebooks: 1,
      turns: [
        {
          q: pick(lang, "Est-ce qu'on peut échanger avec la banque à 3 contre 1 sans port?", "Can we trade with the bank at 3:1 without a harbor?"),
          a: pick(
            lang,
            "Non. Sans port, l'échange avec la banque se fait toujours à 4 ressources identiques contre 1. Le taux de 3 contre 1 demande une colonie ou une ville sur un port générique « 3:1 », et un port spécialisé donne même 2 contre 1 pour sa ressource.",
            "No. Without a harbor, bank trades are always 4 identical resources for 1. The 3:1 rate needs a settlement or city on a generic “3:1” harbor, and a special harbor even gives 2:1 for its resource.",
          ),
          pages: [8, 12],
          fromFaq: true,
        },
        {
          q: pick(lang, "Et le voleur, il bloque aussi le port?", "And does the robber block the harbor too?"),
          a: pick(
            lang,
            "Non : le voleur bloque seulement la production de la tuile où il se trouve. Tes ports restent utilisables même si le voleur est sur une tuile voisine.",
            "No: the robber only stops production on the hex it sits on. Your harbors stay usable even when the robber is on a neighbouring hex.",
          ),
          pages: [9],
        },
      ],
    },
    {
      id: "c-wingspan",
      gameId: "g-wingspan",
      game: "Wingspan",
      title: pick(lang, "Pouvoirs « lorsque joué »", "“When played” powers"),
      hoursAgo: 30,
      rulebooks: 2,
      turns: [
        {
          q: pick(lang, "Les pouvoirs bruns s'activent-ils quand je pose l'oiseau?", "Do brown powers trigger when I play the bird?"),
          a: pick(
            lang,
            "Non. Les pouvoirs bruns (« lorsque activé ») s'activent seulement quand tu fais l'action de la rangée de l'oiseau, de droite à gauche. Ce sont les pouvoirs blancs (« lorsque joué ») qui s'activent à la pose.",
            "No. Brown powers (“when activated”) only trigger when you take that row's action, right to left. White powers (“when played”) are the ones that trigger when you play the bird.",
          ),
          pages: [6, 7],
        },
      ],
    },
    {
      id: "c-dune",
      gameId: "g-dune",
      game: "Dune Imperium",
      title: pick(lang, "Révéler ses cartes", "Revealing your cards"),
      hoursAgo: 75,
      rulebooks: 1,
      turns: [
        {
          q: pick(lang, "Si je révèle mes cartes, est-ce que je peux encore envoyer un agent?", "If I reveal my cards, can I still send an agent?"),
          a: pick(
            lang,
            "Non. Le tour de révélation est ton dernier tour de la manche : tu ne places plus d'agents ensuite. Garde donc les cartes que tu veux révéler, et joue tes agents avant.",
            "No. Your reveal turn is your last turn of the round: you place no more agents afterwards. Keep the cards you want to reveal, and play your agents first.",
          ),
          pages: [11],
          fromFaq: true,
        },
      ],
    },
  ];
}

export type DemoFaq = { id: string; q: string; a: string; pages: number[]; asked: number; verified: boolean };

export function demoFaqGames(lang: Lang) {
  const all = demoFaqAll(lang);
  return Object.entries(all).map(([gameId, list]) => ({ gameId, name: FAQ_GAMES[gameId], count: list.length, mine: gameId !== "g-pandemic" }));
}

const FAQ_GAMES: Record<string, string> = { "g-catan": "Catan", "g-wingspan": "Wingspan", "g-dune": "Dune Imperium", "g-azul": "Azul", "g-codenames": "Codenames", "g-pandemic": "Pandemic" };

export function demoFaq(lang: Lang, gameId: string) {
  const list = demoFaqAll(lang)[gameId];
  return list ? { name: FAQ_GAMES[gameId], entries: list } : null;
}

function demoFaqAll(lang: Lang): Record<string, DemoFaq[]> {
  const f = (id: string, q: [string, string], a: [string, string], pages: number[], asked: number, verified = false): DemoFaq => ({ id, q: pick(lang, ...q), a: pick(lang, ...a), pages, asked, verified });
  return {
    "g-catan": [
      f("f1", ["Peut-on échanger avec la banque à 3 contre 1 sans port?", "Can we trade with the bank at 3:1 without a harbor?"], ["Non : sans port, c'est 4 contre 1. Un port générique donne 3 contre 1, un port spécialisé 2 contre 1 pour sa ressource.", "No: without a harbor it's 4:1. A generic harbor gives 3:1, a special harbor 2:1 for its resource."], [8, 12], 14, true),
      f("f2", ["Que se passe-t-il quand on lance un 7?", "What happens when someone rolls a 7?"], ["Chaque joueur avec plus de 7 cartes en défausse la moitié (arrondie à l'inférieur). Puis on déplace le voleur et on vole une carte à un joueur voisin de la tuile.", "Everyone with more than 7 cards discards half (rounded down). Then the robber moves and steals one card from a player next to that hex."], [9], 11, true),
      f("f3", ["Peut-on construire une route à travers la colonie d'un adversaire?", "Can a road go through an opponent's settlement?"], ["Non : une colonie adverse coupe ta route à cet endroit. Tu ne peux pas continuer de construire au-delà.", "No: an opponent's settlement breaks your road there. You can't keep building past it."], [10], 7),
      f("f4", ["Les cartes Développement jouées le tour où on les achète?", "Development cards played the turn you buy them?"], ["Non, sauf les cartes Point de victoire. Les autres attendent ton prochain tour.", "No, except Victory Point cards. The others wait for your next turn."], [13], 5, true),
    ],
    "g-wingspan": [
      f("f5", ["Les pouvoirs bruns s'activent-ils à la pose de l'oiseau?", "Do brown powers trigger when the bird is played?"], ["Non : seulement quand tu actives la rangée. Les pouvoirs blancs s'activent à la pose.", "No: only when you activate the row. White powers trigger when played."], [6, 7], 9, true),
      f("f6", ["Combien d'œufs peut-on mettre sur un oiseau?", "How many eggs can a bird hold?"], ["Jusqu'à la limite indiquée sur sa carte (les petits œufs dessinés). Pas plus.", "Up to the limit printed on its card (the small egg icons). No more."], [8], 6),
      f("f7", ["La nourriture du jardin d'oiseaux se renouvelle quand?", "When does the birdfeeder get rerolled?"], ["Quand il est vide, ou si tous les dés montrent la même face au moment où tu prends de la nourriture.", "When it's empty, or if all dice show the same face when you gain food."], [9], 4),
    ],
    "g-dune": [
      f("f8", ["Peut-on encore envoyer un agent après avoir révélé?", "Can I still send an agent after revealing?"], ["Non : la révélation est ton dernier tour de la manche.", "No: revealing is your last turn of the round."], [11], 8, true),
      f("f9", ["Combien de troupes peut-on déployer au conflit?", "How many troops can be deployed to the conflict?"], ["Jusqu'à 2 de ta garnison, plus celles recrutées par l'action, quand tu vas sur un espace de combat.", "Up to 2 from your garrison, plus those recruited by the action, when you visit a combat space."], [12], 5),
    ],
    "g-azul": [
      f("f10", ["Que faire avec des tuiles qu'on ne peut pas placer?", "What about tiles you can't place?"], ["Elles vont dans ta ligne plancher et te font perdre des points à la fin de la manche.", "They go to your floor line and cost you points at the end of the round."], [5], 6, true),
      f("f11", ["Qui commence la manche suivante?", "Who starts the next round?"], ["Le joueur qui a pris le jeton premier joueur au centre de la table.", "The player who took the first-player token from the centre."], [4], 3),
    ],
    "g-codenames": [
      f("f12", ["Un indice peut-il être un mot composé?", "Can a clue be a compound word?"], ["Seulement si c'est un vrai mot du dictionnaire; les noms propres sont permis si le groupe l'accepte.", "Only if it's a real dictionary word; proper names are allowed if the table agrees."], [6], 4),
    ],
    "g-pandemic": [
      f("f13", ["Peut-on donner une carte à un joueur dans une autre ville?", "Can you give a card to a player in another city?"], ["Non : vous devez être tous les deux dans la ville de la carte échangée.", "No: you both have to be in the city of the card being shared."], [7], 9, true),
    ],
  };
}
