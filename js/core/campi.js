// Campi del record, liste predefinite e normalizzazione. Nessuna dipendenza dal DOM.

/** Campi nell'ordine delle colonne del foglio "Interventi", raggruppati nelle sezioni del form. */
export const CAMPI = [
  { chiave: 'data', intestazione: 'DATA', sezione: 'Identificazione' },
  { chiave: 'oraAllert', intestazione: 'ORA ALLERT.', sezione: 'Identificazione' },
  { chiave: 'missione', intestazione: 'MISSIONE', sezione: 'Identificazione' },
  { chiave: 'comune', intestazione: 'COMUNE', sezione: 'Mezzo' },
  { chiave: 'mezzo', intestazione: 'MEZZO', sezione: 'Mezzo', lista: 'mezzo' },
  { chiave: 'tipologia', intestazione: 'TIPOLOGIA', sezione: 'Mezzo', lista: 'tipologia' },
  { chiave: 'codiceInvio', intestazione: 'CODICE', sezione: 'Invio CO', lista: 'codiceInvio' },
  { chiave: 'patologiaInvio', intestazione: 'PATOLOGIA', sezione: 'Invio CO', lista: 'patologia' },
  { chiave: 'luogoInvio', intestazione: 'LUOGO', sezione: 'Invio CO', lista: 'luogo' },
  { chiave: 'eta', intestazione: 'ETÀ', sezione: 'Paziente' },
  { chiave: 'sesso', intestazione: 'SESSO', sezione: 'Paziente', lista: 'sesso' },
  { chiave: 'esito', intestazione: 'ESITO', sezione: 'Esito', lista: 'esito' },
  { chiave: 'ospedale', intestazione: 'OSPEDALE', sezione: 'Esito', lista: 'ospedale' },
  { chiave: 'codiceRientro', intestazione: 'CODICE', sezione: 'Rientro', lista: 'codiceRientro' },
  { chiave: 'patologiaRientro', intestazione: 'PATOLOGIA', sezione: 'Rientro', lista: 'patologia' },
  { chiave: 'luogoRientro', intestazione: 'LUOGO', sezione: 'Rientro', lista: 'luogo' },
  { chiave: 'liberoOperativo', intestazione: 'LIBERO OPERATIVO', sezione: 'Tempi' },
];

export const EPOCA = '1970-01-01T00:00:00.000Z';

// Voci del foglio "Liste", nello stesso ordine.
const VOCI = {
  codiceInvio: ['VERDE', 'GIALLO', 'ROSSO'],
  codiceRientro: ['VERDE', 'GIALLO', 'ROSSO', 'NERO'],
  patologia: [
    '01 - Trauma', '02 - Cardio', '03 - Respiro', '04 - Neuro', '05 - Psico', '06 - Onco', '07 - Intossicazione',
    '08 - Metabolica', '09 - Gastro', '10 - Urologica', '11 - Oculistica', '12 - Otorino', '13 - Dermato',
    '14 - Gineco', '15 - Infettiva', '19 - Altro', '20 - Non noto',
  ],
  luogo: ['K - Casa', 'S - Sierra', 'L - Lavoro', 'P - Pubblico', 'Q - Scuola', 'Y - Sportivo', 'Z - Altro'],
  tipologia: ['India', 'Mike'],
  sesso: ['Maschio', 'Femmina'],
  esito: [
    'Trasportato', 'Inviato con MSB', 'Inviato con MSA', 'Inviato con ELI', 'Non Necessita', 'Rifiuto Trasporto',
    'Deceduto', 'Annullato da CO', 'Non Raggiungibile',
  ],
  ospedale: [
    'Alessandria', 'Asti', 'Biella', 'Borgomanero', 'Borgosesia', 'Casale Monferrato', 'Chieri', 'Chivasso', 'Ciriè',
    'Courgnè', 'Cuneo', 'Domodossola', 'Ivrea', 'Moncalieri', 'Mondovì', 'Novara', 'Novi Ligure', 'Omegna',
    'Orbassano', 'Pallanza', 'Rivoli', 'Saluzzo', 'Susa', 'Torino CTO', 'Torino Humanitas', 'Torino Maria Vittoria',
    'Torino Martini', 'Torino Maurizio', 'Torino Molinette', 'Torino Regina Margherita', 'Torino S. Giovanni B',
    'Verbania', 'Vercelli', 'Verduno',
  ],
  mezzo: [
    '3030', '3040', '3050', '3080', '5021', '5022', '5023', '5024', '5035', '5085', '6001', '6021', '6022', '6023',
    '7045', '7046', '7047', '7049', '7050', 'V-ECHO', 'T-ECHO',
  ],
};

// Voci che reggono formule e controlli: non si rinominano né si disattivano.
const SISTEMA = {
  codiceInvio: ['VERDE', 'GIALLO', 'ROSSO'],
  codiceRientro: ['VERDE', 'GIALLO', 'ROSSO', 'NERO'],
  tipologia: ['India', 'Mike'],
  sesso: ['Maschio', 'Femmina'],
  esito: ['Trasportato', 'Deceduto', 'Annullato da CO', 'Non Raggiungibile'],
  mezzo: ['3040', '5022', '5024'],
};

/** Come lo slug di tools/xlsx_to_json.py: 'Ciriè' -> 'cirie'. */
export function slug(testo) {
  return testo.normalize('NFKD').replace(/[^\x00-\x7f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export const LISTE_PREDEFINITE = Object.fromEntries(Object.entries(VOCI).map(([nome, voci]) => [
  nome,
  voci.map((voce) => ({
    id: `${nome}-${slug(voce)}`, voce, attiva: true, sistema: (SISTEMA[nome] ?? []).includes(voce), updatedAt: EPOCA,
  })),
]));

export function isDataValida(testo) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(testo ?? '');
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function isOraValida(testo) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(testo ?? '');
}

/** '08:58' -> 538 */
export function minutiDaOra(testo) {
  return Number(testo.slice(0, 2)) * 60 + Number(testo.slice(3, 5));
}

function normalizzaEta(valore) {
  if (valore === null || valore === undefined) return null;
  if (typeof valore === 'number') return valore;
  const testo = String(valore).trim().replace(',', '.');
  if (testo === '') return null;
  return /^-?\d+(\.\d+)?$/.test(testo) ? Number(testo) : testo;
}

/** Record completo e ripulito: spazi tolti, COMUNE e MISSIONE in maiuscolo, età numerica. */
export function normalizzaRecord(r) {
  const out = {
    id: r.id,
    createdAt: r.createdAt || EPOCA,
    updatedAt: r.updatedAt || EPOCA,
    deleted: r.deleted === true,
  };
  for (const { chiave } of CAMPI) {
    if (chiave === 'eta') {
      out.eta = normalizzaEta(r.eta);
      continue;
    }
    const testo = r[chiave] === null || r[chiave] === undefined ? '' : String(r[chiave]).trim();
    out[chiave] = chiave === 'comune' || chiave === 'missione' ? testo.toUpperCase() : testo;
  }
  return out;
}
