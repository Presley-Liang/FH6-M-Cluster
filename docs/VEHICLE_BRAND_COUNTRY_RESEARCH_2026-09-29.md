# Vehicle brand countries and presentation regions — 2026-09-29

## Result

`src/vehicle/vehicle-metadata.js` now resolves a vehicle's country in this order:

1. Exact carOrdinal match from the official FH6 car roster.
2. Reviewed make/brand country default.
3. `unknown` when the catalog has no identifiable make.

The existing country-to-region mapping then resolves the presentation group. China, South Korea, and Australia use the Japan group per the three-region project convention. The three generic traffic assets resolve to fictional UK make Playground; the Null Car stays unknown because it is a fallback model rather than the selected vehicle's identity. This is presentation grouping and does not claim where an individual car was assembled.

The country mapping covers the exact parser spellings, including `Bently`, `Merceds-AMG`, and `Nisan`. The three traffic entries omit the fictional make prefix in the telemetry catalog, so ordinal overrides identify them as Playground. The Null Car's Falcon-like appearance is not used as the selected vehicle identity.

## Country and region decisions

| Region group | Countries used | Brands |
| --- | --- | --- |
| Europe | UK, Germany, Italy, France, Austria, Sweden, Croatia, Denmark | Abarth, Alfa Romeo, Apollo, Ariel, Aston Martin, Audi, Austin-Healey, BAC, Bentley/Bently, BMW, De Tomaso, Ferrari, Fiat, Ginetta, Gordon Murray, Jaguar, KTM, Koenigsegg, Lamborghini, Lancia, Land Rover, Lotus, Maserati, McLaren, Mercedes-AMG/Mercedes-Benz/Merceds-AMG, MG, MINI, Noble, Opel, Pagani, Peel, Peugeot, Playground (generic traffic assets), Porsche, Radical, Reliant, Renault, Rimac, TVR, Ultima, Vauxhall, Volkswagen, Volvo, Zenvo |
| Americas | USA, Canada | Acura, Alumicraft, AMG Transport Dynamics, Buick, Cadillac, Can-Am, Casey Currie Motorsports, Chevrolet, DeBerti, DeLorean, Dodge, Exomotive, Ford, Formula Drift, Funco, GMC, Hennessey, Jimco, Lucid, Lincoln, Meyers, Penhall, Plymouth, Polaris, Pontiac, Ram, Rivian, RJ Anderson, Saleen, Shelby, Sierra Cars, Viper |
| Japan | Japan, China, South Korea, Australia | Autozam, Datsun, GR, Holden, Honda, Hyundai, Lexus, Mazda, Mazdaspeed, Mitsubishi, Nissan/Nisan, Subaru, Toyota, Wuling |

## Sources consulted

- [Official Forza Horizon 6 car list](https://forza.net/fh6cars): primary source for model names, country labels, and special/competition makes; used for exact-model matches and makes without a conventional real-world OEM identity.
- [Playground vehicle/make overview](https://forzahorizonwiki.com/wiki/playground/) and [Null Car overview](https://forzahorizonwiki.com/wiki/null-car/): community-maintained references confirming Playground's generic traffic assets, fictional UK maker tag, and why the Null Car's Falcon-like appearance is only a fallback model. These are secondary references, so the Null Car is deliberately not assigned the Falcon's make.
- [Toyota history](https://global.toyota/en/company/trajectory-of-toyota/history/), [Honda history](https://global.honda/en/about/history-digest/), [Mazda history](https://www.mazda.com/en/about/history/), [Nissan heritage](https://www.nissan-global.com/EN/HERITAGE_COLLECTION/short_story/en_p05-01.html), [Mitsubishi Motors profile](https://www.mitsubishi-motors.com/en/company/information/index.html), and [Hyundai corporate profile](https://www.hyundai.com/worldwide/ko/company/hyundai-world-wide): Japanese/Korean marque origins and corporate identity.
- [GM Heritage](https://www.gm.com/heritage), [Ford history](https://corporate.ford.com/corporate/corporate/articles/history/henry-ford-biography/), [BRP company history](https://www.brp.com/en/our-company/about-us.html), and [Polaris company profile](https://www.polaris.com/en-us/proud/): North American makes, groups, and company identity.
- [Volkswagen Group brands and locations](https://www.volkswagen-group.com/en/group/portrait-and-production-plants.html), [BMW history](https://www.bmwgroup.com/en/company/history.html), [Mercedes-Benz history](https://group.mercedes-benz.com/company/tradition/company-history/), and [Stellantis brands](https://www.stellantis.com/en/brands): European marque and corporate histories.
- [Koenigsegg about](https://www.koenigsegg.com/about), [Volvo heritage](https://www.volvocars.com/us/our-heritage/), [Rimac about](https://www.rimac-automobili.com/about-us/), [Zenvo about](https://zenvoautomotive.com/about/), and [KTM X-BOW history](https://www.ktm.com/en-int/X-BOW/x-bow-news/-a-super-sportscar-like-no-other--): European specialist manufacturers.
- [Wuling company profile](https://www.wulingmotor.com/about-us/), [GM China operations](https://www.gm.com.cn/en/home/company/operations.html), and [National Museum of Australia — Holden](https://www.nma.gov.au/exhibitions/defining-symbols-australia/holden): Wuling and Holden identity.
- [Halo Waypoint — AMG Transport Dynamics](https://www.halowaypoint.com/news/outpost-discoveries): confirms this is a fictional Halo vehicle maker; its country grouping follows the FH6 roster rather than being represented as an actual-world manufacturer origin.
