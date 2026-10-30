// Modifica delle liste dei menu: aggiungi, rinomina, disattiva. Le voci non si cancellano mai.
import { CAMPI, slug } from './campi.js';

const BLOCCATA = 'Questa voce non si può modificare: la usano statistiche e controlli.';

const stessaVoce = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

function controllaNome(lista, testo, idEscluso = null) {
  const voce = String(testo ?? '').trim();
  if (!voce) throw new Error('Scrivi il nome della voce.');
  if (lista.some((v) => v.id !== idEscluso && stessaVoce(v.voce, voce))) throw new Error(`La voce "${voce}" esiste già.`);
  return voce;
}

/** Campi del record che usano una lista: 'patologia' -> patologiaInvio e patologiaRientro. */
export function campiDellaLista(nome) {
  return CAMPI.filter((c) => c.lista === nome).map((c) => c.chiave);
}

export function aggiungiVoce(liste, nome, testo, adesso) {
  const lista = liste[nome] ?? [];
  const voce = controllaNome(lista, testo);
  const base = `${nome}-${slug(voce)}`;
  let id = base;
  for (let n = 2; lista.some((v) => v.id === id); n++) id = `${base}-${n}`;
  return { ...liste, [nome]: [...lista, { id, voce, attiva: true, sistema: false, updatedAt: adesso.toISOString() }] };
}

/** Rinomina e restituisce anche i record (non eliminati) da aggiornare con il nuovo nome. */
export function rinominaVoce(liste, records, nome, id, testo, adesso) {
  const lista = liste[nome] ?? [];
  const vecchia = lista.find((v) => v.id === id);
  if (!vecchia) throw new Error('Voce non trovata.');
  if (vecchia.sistema) throw new Error(BLOCCATA);
  const voce = controllaNome(lista, testo, id);
  const istante = adesso.toISOString();
  const campi = campiDellaLista(nome);
  const modificati = records
    .filter((r) => !r.deleted && campi.some((k) => r[k] === vecchia.voce))
    .map((r) => {
      const nuovo = { ...r, updatedAt: istante };
      for (const k of campi) if (r[k] === vecchia.voce) nuovo[k] = voce;
      return nuovo;
    });
  return {
    liste: { ...liste, [nome]: lista.map((v) => (v.id === id ? { ...v, voce, updatedAt: istante } : v)) },
    modificati,
  };
}

export function impostaAttiva(liste, nome, id, attiva, adesso) {
  const lista = liste[nome] ?? [];
  const voce = lista.find((v) => v.id === id);
  if (!voce) throw new Error('Voce non trovata.');
  if (voce.sistema && !attiva) throw new Error(BLOCCATA);
  return { ...liste, [nome]: lista.map((v) => (v.id === id ? { ...v, attiva, updatedAt: adesso.toISOString() } : v)) };
}

/** Voci da proporre nel form: le attive, più il valore già salvato se non è tra queste. */
export function vociPerScelta(lista, valoreCorrente) {
  const voci = (lista ?? []).filter((v) => v.attiva).map((v) => v.voce);
  return valoreCorrente && !voci.includes(valoreCorrente) ? [...voci, valoreCorrente] : voci;
}
