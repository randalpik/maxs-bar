/** Syrup recipes for the read-only Syrups reference tab.
 *  Mirrors docs/syrups.txt (Max's source of truth); embedded here so the
 *  production build stays self-contained, same as seed.ts does for recipes. */
export const SYRUPS_TXT = `Simple: bring 1 L water and 1 kg sugar to boil
Demerara: bring 1 L water and 1 kg demerara/turbinado sugar to boil
Vanilla: add 7 g vanilla extract per 1 L simple syrup
Orgeat: grind 2 cups of blanched almonds in food processor, boil 1.5 c. sugar and 1.25 c. water for 3 minutes, add almonds, turn to low heat and simmer for 3 minutes, increase the temperature, remove when it starts to boil, infuse for 3-8 hours, strain through 2 layers of cheesecloth, add 1 oz. brandy and 1/2 tsp. orange flower water
Cinnamon: bring 1 L water and 12.5 g saigon cinnamon to boil, simmer for 10 min, weigh, return to heat and add equal weight sugar, bring to boil, strain
Lapsang: bring 1 L water to boil, remove from heat and steep with 1/2 cup looseleaf lapsang tea for 20 minutes, add 1.75 cup white sugar and 1/4 cup brown sugar, steep for 5 more minutes, strain, add pinch of salt [and citric acid]
Lemon: infuse simple syrup with lemon peels while cooling, remove and strain
Ginger: infuse brown sugar simple syrup with ginger pieces while cooling, remove and strain
Honey: mix 2 parts clover honey with 1 part hot water
Raspberry: muddle 1/2 cup raspberries, add 1 cup sugar and let macerate for 30 minutes, add 1/2 cup warm water and stir until dissolved, strain, add 1/2 oz. neutral spirit`;

export interface Syrup {
  name: string;
  steps: string[];
}

/** Parse the embedded syrups into a consistent name + ordered-steps shape.
 *  Steps are the comma-separated clauses of each recipe, first letter capitalised. */
export function parseSyrups(txt: string = SYRUPS_TXT): Syrup[] {
  return txt.split('\n').map(l => l.trim()).filter(l => l.includes(':')).map(line => {
    const idx = line.indexOf(':');
    const name = line.slice(0, idx).trim();
    const steps = line.slice(idx + 1).split(',').map(s => s.trim()).filter(Boolean)
      .map(s => s.charAt(0).toUpperCase() + s.slice(1));
    return { name, steps };
  });
}
