# Historical handoff: `migration-analyze` v0

> Status on 2026-09-04: historical handoff for the preserved
> `migration-analyze` v0.1.0 benchmark reference. For new work, read
> `README.md`, `docs\skill-handoff-protocol-v0.9.md` and the active flow
> experimental skill acceptance documents first.

Gebruik `/copilot-skill-authoring` en vervolg het
React-naar-Angular-migratieonderzoek vanuit deze lokale labrepository.

## Repository status

`C:\Project\migration-skill-lab` is lokaal aangemaakt en heeft bewust:

- geen remote;
- geen commits;
- geen dependencies;
- geen gepubliceerde runtime skill.

`C:\Project\frontend` is de productrepository en blijft volledig read-only.
De worktree had vooraf al `D .env.example`; herstel of wijzig dit niet.

## Lees eerst

1. `C:\Project\migration-skill-lab\README.md`
2. `C:\Project\migration-skill-lab\docs\project-seed.md`
3. `C:\Project\migration-skill-lab\docs\migration-analyze-v0-acceptance.md`
4. `C:\Project\migration-skill-lab\backlog\backlog.json`
5. `C:\Project\migration-skill-lab\schemas\backlog.schema.json`
6. `C:\Project\migration-skill-lab\scripts\render-backlog.mjs`

Kerncontext indien nodig:

- `C:\Obsidian\Notes 2025\Lely\Angular migratie - skillarchitectuur.md`
- `C:\Obsidian\Notes 2025\Lely\Angular migratie - conventions onderzoek.md`
- `C:\Obsidian\Notes 2025\Lely\Angular migratie - stageaanpak en haalbaarheid.md`

Inventariseer andere Lely-notities alleen op bestandsnaam en lees uitsluitend
aantoonbaar relevante secties. Laad niet standaard de hele vault.

Read-only upstream ontwerpbron, gepind op:

`https://github.com/AirMile/claude-config/tree/a25190fb494efa37ce09f3377cae994d33db9529`

Neem daarvan geen skills volledig over en maak geen symlink. Ontwerp
Copilot-native gedrag expliciet; veronderstel niet dat Claude Workflow,
TaskCreate, hooks, worktrees, modelrouting of merge/finalize hetzelfde
werken.

## Oorspronkelijk doel van deze chat

Rond eerst Gate 1 af en bouw daarna alleen `migration-analyze` v0:

1. Review samen met de gebruiker de acceptatiecriteria en benoem alleen
   beslissingen die materieel gedrag veranderen.
2. Bevestig een veilige reportlocatie. Aanbevolen kandidaat:
   `C:\Obsidian\Notes 2025\Lely\Angular migratie\analyses\`.
   Gebruik daarnaast hooguit compacte, niet-gevoelige benchmarkstate onder
   de genegeerde `runs\`-folder van deze labrepository.
3. Inspecteer in `C:\Project\frontend` gericht drie kleine
   benchmarkkandidaten met bestaande tests. Stel één eenvoudige feature voor
   en laat de gebruiker die boundary goedkeuren.
4. Leg vóór skillauthoring een compacte handmatige reference analysis voor
   die eenvoudige case vast, zodat de benchmark niet door de skill zelf wordt
   bepaald.
5. Ontwerp een minimale folder- en referencestructuur voor alleen
   `migration-analyze` v0 en laat de gebruiker die goedkeuren voordat
   skillbestanden worden geschreven.
6. Maak daarna de source skill in deze labrepository. Publiceer of kopieer
   hem niet automatisch naar `~\.copilot\skills`; dat vereist aparte
   menselijke goedkeuring.
7. Valideer de skill tegen de eenvoudige case volgens
   `docs\migration-analyze-v0-acceptance.md`.

## Verplichte skilluitvoer

- feature boundary;
- behavior baseline;
- dependency map;
- evidence en contradictions;
- test gaps;
- dimensioned risk classification;
- open questions met owner, impact en blockerfase;
- file/line citations;
- labels `Confirmed`, `Inference` en `Open question`;
- compacte versioned machine-readable summary zonder codekopieën.

## Conventionsstatus

Gebruik de React-teaminput van 2 september 2026 als voorlopige
reviewcriteria. Houd vijf concrete `Team input`-regels apart van algemene
reviewvragen.

Huidige tooling staat onder andere expliciete `any` en `@ts-ignore` toe.
Rapporteer die tegenstelling en noem de strengere teaminput niet
tool-enforced.

Bernhards input over Angular-conventies ontbreekt. Verzin of extrapoleer geen
Angular-doelconventies uit React-regels. Ontbrekende Angular-conventies zijn
`Open question`; ze blokkeren een read-only React-behavioranalyse niet, maar
wel ongefundeerde target-designclaims.

## Veiligheidsgrenzen

- Geen dependency-installatie.
- Geen wijziging aan `C:\Project\frontend`.
- Geen commits, branches, remotes, pushes, merges, pull requests of externe
  writes.
- Geen credentials, tokens, private URLs of volledige codekopieën in state
  of reports.
- Geen Lely-informatie in publieke repositories.
- Geen server of langlevend achtergrondproces voor de backlog.
- De skill mag zichzelf tijdens een run nooit wijzigen.
- Improvement feedback is alleen een proposal en vereist menselijke
  goedkeuring.

## Backlog

`backlog\backlog.json` is canonical. `backlog\backlog.html` is generated,
standalone en read-only.

Wijzig alleen JSON en genereer HTML daarna met:

```powershell
node .\scripts\render-backlog.mjs
```

Valideer met:

```powershell
node .\scripts\render-backlog.mjs --self-test
node .\scripts\render-backlog.mjs --check
```

Werk backlogstatus alleen bij wanneer de bijbehorende gate werkelijk is
gehaald.

## Eerste actie

Begin met het lezen van de zes labbestanden. Geef daarna een compacte Gate
1-review en stel de eerste materiële keuze via één gerichte vraag aan de
gebruiker.

Schrijf nog geen skillbestand vóór de vereiste goedkeuringen.
