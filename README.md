# Fahrrad-Führerschein 3D

A German 3D learning app for primary school kids (grade 3/4) preparing for the cycling test (Radfahrprüfung):
who goes first at a junction, traffic signs, lights, zebra crossings, one-way streets and roundabouts.
Kids tap the road users in the right order or pick an answer, watch the scene play out, and get the rule
explained in child-friendly German, with a source in the StVO.

**Live:** https://fahrrad.michikrug.de (works offline once loaded, can be added to the home screen)

Built with Vite, TypeScript and three.js. All 3D models, traffic signs and sounds are generated in code; no asset files.

## Develop

```sh
npm install
npm run dev     # dev server, also reachable from phones on the same network
npm run check   # type check + tests (bun test)
```

Tasks and rules live in `src/content/` as plain data.

## Deploy

Static files on Cloudflare Workers (see `wrangler.jsonc`):

```sh
npm run build && npx wrangler deploy
```

## Licence

MIT, see [LICENSE](LICENSE). Rules are paraphrased from the StVO; this app does not replace the official
teaching material of your school or the Verkehrswacht.
