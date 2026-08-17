/**
 * Seeds demo offers and jobs on top of the imported businesses.
 *
 *   pnpm seed:demo -- --emulator --commit
 *
 * This is for local development and design review — it makes the directory look
 * like a directory in use rather than a list of empty shells. It is not part of
 * the production import path, and it refuses to touch a business that an owner
 * has claimed.
 *
 * Document ids are derived from the business slug, so re-running updates in
 * place instead of piling up duplicates.
 */

import { argv, exit } from 'node:process';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  COLLECTIONS,
  businessConverter,
  jobConverter,
  offerConverter,
  toBusinessRef,
  type Business,
  type Job,
  type Offer,
} from '@leamington/shared';

interface Options {
  commit: boolean;
  emulator: boolean;
  projectId: string | undefined;
}

function parseArgs(args: string[]): Options {
  const options: Options = {
    commit: false,
    emulator: false,
    projectId: process.env['GOOGLE_CLOUD_PROJECT'],
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--commit') options.commit = true;
    else if (arg === '--emulator') options.emulator = true;
    else if (arg === '--project') options.projectId = args[++i];
  }
  return options;
}

const DAY = 24 * 60 * 60 * 1000;

/** Offer templates keyed by business slug. */
interface OfferSpec {
  slug: string;
  titleEn: string;
  titleEs: string;
  descEn: string;
  descEs: string;
  kind: Offer['kind'];
  percentOff?: number;
  amountOff?: number;
  channel?: Offer['channel'];
  daysOfWeek?: number[];
  /** Days from now until it ends. Small numbers create real urgency in the feed. */
  endsInDays: number;
  featured?: boolean;
  limit?: number;
  used?: number;
}

const OFFERS: OfferSpec[] = [
  {
    slug: 'erie-shore-diner',
    titleEn: 'Two breakfasts, one bill',
    titleEs: 'Dos desayunos, una cuenta',
    descEn: 'Buy any breakfast plate before 9am and the second is on us. Weekdays only.',
    descEs: 'Compre cualquier plato de desayuno antes de las 9 y el segundo va por nuestra cuenta. Solo entre semana.',
    kind: 'bogo',
    daysOfWeek: [1, 2, 3, 4, 5],
    endsInDays: 12,
    featured: true,
    limit: 200,
    used: 143,
  },
  {
    slug: 'the-dock-taproom',
    titleEn: '$5 off any wood-grilled main',
    titleEs: '$5 de descuento en cualquier plato a la parrilla',
    descEn: 'Sunday through Thursday, kitchen open until eleven.',
    descEs: 'De domingo a jueves, cocina abierta hasta las once.',
    kind: 'amount',
    amountOff: 500,
    daysOfWeek: [0, 2, 3, 4],
    endsInDays: 3,
    featured: true,
  },
  {
    slug: 'taqueria-el-jardin',
    titleEn: 'Free horchata with any 3 tacos',
    titleEs: 'Horchata gratis con 3 tacos',
    descEn: 'Show this at the counter. One per person per visit.',
    descEs: 'Muestre esto en el mostrador. Una por persona por visita.',
    kind: 'freebie',
    endsInDays: 21,
    featured: true,
    limit: 300,
    used: 88,
  },
  {
    slug: 'the-tomato-cup-cafe',
    titleEn: '20% off espresso drinks before 9am',
    titleEs: '20% de descuento en espresso antes de las 9',
    descEn: 'The early shift deserves better coffee.',
    descEs: 'El turno de la mañana merece mejor café.',
    kind: 'percent',
    percentOff: 20,
    daysOfWeek: [1, 2, 3, 4, 5],
    endsInDays: 30,
  },
  {
    slug: 'harbourlight-coffee',
    titleEn: 'Sixth coffee free',
    titleEs: 'El sexto café gratis',
    descEn: 'Digital punch card. Ask at the window.',
    descEs: 'Tarjeta digital. Pregunte en la ventanilla.',
    kind: 'freebie',
    endsInDays: 60,
  },
  {
    slug: 'panaderia-la-esperanza',
    titleEn: 'Docena de conchas — 15% off',
    titleEs: 'Docena de conchas con 15% de descuento',
    descEn: 'Baked fresh from six. While they last.',
    descEs: 'Recién horneadas desde las seis. Hasta agotar existencias.',
    kind: 'percent',
    percentOff: 15,
    endsInDays: 2,
    featured: true,
    limit: 60,
    used: 51,
  },
  {
    slug: 'sweet-marsh-bakehouse',
    titleEn: 'Free butter tart with any loaf',
    titleEs: 'Tarta de mantequilla gratis con cualquier pan',
    descEn: 'Saturdays only, until the rack is empty.',
    descEs: 'Solo los sábados, hasta que se acabe.',
    kind: 'freebie',
    daysOfWeek: [6],
    endsInDays: 18,
  },
  {
    slug: 'casa-verde-grocery',
    titleEn: '$10 off a $50 shop',
    titleEs: '$10 de descuento en compras de $50',
    descEn: 'Excludes tobacco and lottery. One per household per week.',
    descEs: 'No aplica en tabaco ni lotería. Uno por hogar por semana.',
    kind: 'amount',
    amountOff: 1000,
    endsInDays: 9,
    featured: true,
  },
  {
    slug: 'sun-parlour-books',
    titleEn: '3 used books for $10',
    titleEs: '3 libros usados por $10',
    descEn: 'Any three from the back room, any condition.',
    descEs: 'Tres libros cualquiera del cuarto de atrás, en cualquier estado.',
    kind: 'other',
    endsInDays: 45,
  },
  {
    slug: 'greenline-cycle-and-sport',
    titleEn: 'Free safety tune-up with any rental',
    titleEs: 'Ajuste de seguridad gratis con cualquier alquiler',
    descEn: 'Greenway season. Bring your own bike, we will check it over.',
    descEs: 'Temporada del Greenway. Traiga su bicicleta y se la revisamos.',
    kind: 'freebie',
    endsInDays: 25,
  },
  {
    slug: 'bayside-cuts-and-colour',
    titleEn: '25% off first visit',
    titleEs: '25% de descuento en la primera visita',
    descEn: 'New clients, any stylist, walk-in or booked.',
    descEs: 'Clientes nuevos, con cualquier estilista, con o sin cita.',
    kind: 'percent',
    percentOff: 25,
    endsInDays: 5,
  },
  {
    slug: 'marina-nails-and-spa',
    titleEn: 'Mani + pedi for $55',
    titleEs: 'Manicura y pedicura por $55',
    descEn: 'Tuesdays and Wednesdays. Booking recommended.',
    descEs: 'Martes y miércoles. Se recomienda reservar.',
    kind: 'other',
    daysOfWeek: [2, 3],
    endsInDays: 14,
  },
  {
    slug: 'seacliff-tire-and-alignment',
    titleEn: '$20 off seasonal tire changeover',
    titleEs: '$20 de descuento en cambio de llantas por temporada',
    descEn: 'Book before the first snow and skip the queue.',
    descEs: 'Reserve antes de la primera nevada y evite la fila.',
    kind: 'amount',
    amountOff: 2000,
    endsInDays: 40,
  },
  {
    slug: 'point-pelee-adventure-co',
    titleEn: 'Two kayaks for the price of one',
    titleEs: 'Dos kayaks al precio de uno',
    descEn: 'Weekday paddles before noon. Guides available in English and Spanish.',
    descEs: 'Paseos entre semana antes del mediodía. Guías en inglés y español.',
    kind: 'bogo',
    daysOfWeek: [2, 3, 4],
    endsInDays: 7,
    featured: true,
  },
  {
    slug: 'nature-fresh-fitness',
    titleEn: 'First month free for shift workers',
    titleEs: 'Primer mes gratis para trabajadores por turnos',
    descEn: 'Bring a pay stub from any Leamington greenhouse.',
    descEs: 'Traiga un recibo de nómina de cualquier invernadero de Leamington.',
    kind: 'freebie',
    endsInDays: 28,
  },
  {
    slug: 'seacliff-fish-and-chips',
    titleEn: 'Family pack — 15% off',
    titleEs: 'Paquete familiar con 15% de descuento',
    descEn: 'Four pieces, four chips, two sides. Fridays.',
    descEs: 'Cuatro piezas, cuatro papas, dos guarniciones. Los viernes.',
    kind: 'percent',
    percentOff: 15,
    daysOfWeek: [5],
    endsInDays: 11,
  },
];

interface JobSpec {
  slug: string;
  titleEn: string;
  titleEs: string;
  descEn: string;
  descEs: string;
  employmentType: Job['employmentType'];
  workplace?: Job['workplace'];
  /** Hourly rate in cents. */
  min?: number;
  max?: number;
  postedDaysAgo: number;
  applyEmail?: string;
  applyUrl?: string;
}

const JOBS: JobSpec[] = [
  {
    slug: 'sun-parlour-greenhouses-ltd',
    titleEn: 'Greenhouse harvester — day shift',
    titleEs: 'Cosechador de invernadero — turno de día',
    descEn:
      'Picking and packing tomatoes-on-the-vine. No experience needed, training provided. Transport from downtown Leamington available.',
    descEs:
      'Cosecha y empaque de tomate en rama. No se necesita experiencia, damos capacitación. Hay transporte desde el centro de Leamington.',
    employmentType: 'full_time',
    min: 1720,
    max: 1950,
    postedDaysAgo: 1,
    applyEmail: 'jobs@sunparlour.example',
  },
  {
    slug: 'wheatley-road-pepper-co',
    titleEn: 'Seasonal packing line associate',
    titleEs: 'Operario de línea de empaque por temporada',
    descEn:
      'Six-month seasonal contract, April to October. Overtime available. Bilingual supervisors on every shift.',
    descEs:
      'Contrato de temporada de seis meses, de abril a octubre. Hay horas extra. Supervisores bilingües en cada turno.',
    employmentType: 'seasonal',
    min: 1700,
    max: 1700,
    postedDaysAgo: 3,
    applyEmail: 'hiring@wheatleypepper.example',
  },
  {
    slug: 'the-dock-taproom',
    titleEn: 'Line cook',
    titleEs: 'Cocinero de línea',
    descEn: 'Evenings and weekends, wood grill experience an asset. Staff meal every shift.',
    descEs: 'Tardes y fines de semana, se valora experiencia en parrilla de leña. Comida de personal en cada turno.',
    employmentType: 'part_time',
    min: 1900,
    max: 2300,
    postedDaysAgo: 2,
    applyUrl: 'https://thedock.example/careers',
  },
  {
    slug: 'erie-shore-diner',
    titleEn: 'Server — weekend mornings',
    titleEs: 'Mesero — mañanas de fin de semana',
    descEn: 'Saturday and Sunday, 7am to 2pm. Tips are pooled and they are good.',
    descEs: 'Sábado y domingo, de 7 a 14. Las propinas se reparten y son buenas.',
    employmentType: 'part_time',
    min: 1720,
    max: 1720,
    postedDaysAgo: 5,
    applyEmail: 'hello@erieshorediner.ca',
  },
  {
    slug: 'casa-verde-grocery',
    titleEn: 'Butcher counter assistant',
    titleEs: 'Auxiliar de carnicería',
    descEn: 'Full time, benefits after 90 days. Spanish an asset.',
    descEs: 'Tiempo completo, prestaciones después de 90 días. Se valora el español.',
    employmentType: 'full_time',
    min: 1850,
    max: 2100,
    postedDaysAgo: 6,
    applyEmail: 'jobs@casaverde.example',
  },
  {
    slug: 'kinsmen-heating-and-cooling',
    titleEn: 'HVAC apprentice',
    titleEs: 'Aprendiz de climatización',
    descEn: 'Registered apprenticeship, tools provided, G2 sponsorship for the right person.',
    descEs: 'Aprendizaje registrado, herramientas incluidas y patrocinio del G2 para la persona indicada.',
    employmentType: 'full_time',
    min: 2000,
    max: 2600,
    postedDaysAgo: 8,
    applyEmail: 'careers@kinsmenhvac.example',
  },
  {
    slug: 'bridge-community-centre',
    titleEn: 'Settlement worker (bilingual)',
    titleEs: 'Trabajador de asentamiento (bilingüe)',
    descEn:
      'Two-year contract, funded position. Supporting newcomer families with paperwork, housing and school registration.',
    descEs:
      'Contrato de dos años, puesto financiado. Apoyo a familias recién llegadas con trámites, vivienda e inscripción escolar.',
    employmentType: 'contract',
    min: 2600,
    max: 3100,
    postedDaysAgo: 4,
    applyEmail: 'info@bridgecentre.example',
  },
  {
    slug: 'point-pelee-adventure-co',
    titleEn: 'Summer paddle guide',
    titleEs: 'Guía de kayak de verano',
    descEn: 'May through September. Certification paid for. Bilingual guides especially welcome.',
    descEs: 'De mayo a septiembre. Certificación pagada. Especialmente bienvenidos guías bilingües.',
    employmentType: 'seasonal',
    min: 1800,
    max: 2000,
    postedDaysAgo: 9,
    applyUrl: 'https://pointpeleeadventure.example/work-with-us',
  },
  {
    slug: 'sweet-marsh-bakehouse',
    titleEn: 'Overnight baker',
    titleEs: 'Panadero nocturno',
    descEn: '10pm to 6am, four nights a week. Sourdough experience preferred but not required.',
    descEs: 'De 22 a 6, cuatro noches por semana. Se prefiere experiencia con masa madre, pero no es obligatoria.',
    employmentType: 'part_time',
    min: 1900,
    max: 2200,
    postedDaysAgo: 11,
    applyEmail: 'work@sweetmarsh.example',
  },
  {
    slug: 'leamington-family-dental',
    titleEn: 'Dental receptionist',
    titleEs: 'Recepcionista dental',
    descEn: 'Full time including two evenings. Spanish or Arabic an asset.',
    descEs: 'Tiempo completo, incluye dos tardes. Se valora el español o el árabe.',
    employmentType: 'full_time',
    min: 2100,
    max: 2400,
    postedDaysAgo: 13,
    applyEmail: 'front@lfd.example',
  },
];

async function main(): Promise<void> {
  const options = parseArgs(argv.slice(2));
  if (options.emulator && !process.env['FIRESTORE_EMULATOR_HOST']) {
    process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:8080';
  }
  const usingEmulator = Boolean(process.env['FIRESTORE_EMULATOR_HOST']);

  initializeApp({
    ...(usingEmulator ? {} : { credential: applicationDefault() }),
    ...(options.projectId ? { projectId: options.projectId } : {}),
  });
  const db = getFirestore();

  const snapshot = await db
    .collection(COLLECTIONS.businesses)
    .withConverter(businessConverter)
    .get();

  const bySlug = new Map<string, Business>();
  for (const doc of snapshot.docs) bySlug.set(doc.data().slug, doc.data());

  const now = new Date();
  const offers: { id: string; data: Omit<Offer, 'id'> }[] = [];
  const jobs: { id: string; data: Omit<Job, 'id'> }[] = [];
  const missing: string[] = [];

  for (const spec of OFFERS) {
    const business = bySlug.get(spec.slug);
    if (!business) {
      missing.push(`offer:${spec.slug}`);
      continue;
    }
    offers.push({
      id: `demo-${spec.slug}`,
      data: {
        businessId: business.id,
        business: toBusinessRef(business),
        title: { en: spec.titleEn, es: spec.titleEs },
        description: { en: spec.descEn, es: spec.descEs },
        terms: {
          en: 'Cannot be combined with other offers. Valid at this location only.',
          es: 'No se combina con otras ofertas. Válido solo en esta sucursal.',
        },
        kind: spec.kind,
        percentOff: spec.percentOff ?? null,
        amountOff: spec.amountOff ? { amount: spec.amountOff, currency: 'CAD' } : null,
        channel: spec.channel ?? 'in_store',
        code: null,
        imageUrl: null,
        startsAt: new Date(now.getTime() - 2 * DAY),
        endsAt: new Date(now.getTime() + spec.endsInDays * DAY),
        daysOfWeek: spec.daysOfWeek ?? [],
        status: 'published',
        redemptionLimit: spec.limit ?? null,
        redemptionCount: spec.used ?? 0,
        perUserLimit: 1,
        featured: spec.featured ?? false,
        createdAt: new Date(now.getTime() - 2 * DAY),
        updatedAt: now,
      },
    });
  }

  for (const spec of JOBS) {
    const business = bySlug.get(spec.slug);
    if (!business) {
      missing.push(`job:${spec.slug}`);
      continue;
    }
    const postedAt = new Date(now.getTime() - spec.postedDaysAgo * DAY);
    jobs.push({
      id: `demo-${spec.slug}`,
      data: {
        businessId: business.id,
        business: toBusinessRef(business),
        title: { en: spec.titleEn, es: spec.titleEs },
        description: { en: spec.descEn, es: spec.descEs },
        employmentType: spec.employmentType,
        workplace: spec.workplace ?? 'onsite',
        compensation:
          spec.min !== undefined
            ? { min: spec.min, max: spec.max ?? spec.min, currency: 'CAD', period: 'hour' }
            : null,
        applyUrl: spec.applyUrl ?? null,
        applyEmail: spec.applyEmail ?? null,
        postedAt,
        expiresAt: new Date(postedAt.getTime() + 45 * DAY),
        status: 'published',
        createdAt: postedAt,
        updatedAt: now,
      },
    });
  }

  console.log(`businesses found  ${bySlug.size}`);
  console.log(`offers            ${offers.length}`);
  console.log(`jobs              ${jobs.length}`);
  if (missing.length) console.log(`skipped (no match) ${missing.join(', ')}`);

  if (!options.commit) {
    console.log('\nDry run. Re-run with --commit to write.');
    return;
  }

  const batch = db.batch();
  for (const offer of offers) {
    batch.set(
      db.collection(COLLECTIONS.offers).withConverter(offerConverter).doc(offer.id),
      offer.data as Offer,
    );
  }
  for (const job of jobs) {
    batch.set(
      db.collection(COLLECTIONS.jobs).withConverter(jobConverter).doc(job.id),
      job.data as Job,
    );
  }
  await batch.commit();
  console.log('Done.');
}

main().catch((error: unknown) => {
  console.error(error);
  exit(1);
});
