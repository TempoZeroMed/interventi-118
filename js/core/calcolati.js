// Colonne calcolate del foglio "Interventi": DURATA, MESE, ORA DEL GIORNO, Δ CODICE.
import { isDataValida, isOraValida, minutiDaOra } from './campi.js';

export const SCALA_CODICI = ['VERDE', 'GIALLO', 'ROSSO'];

/** MOD(HOUR(R)*60+MINUTE(R)-HOUR(C)*60-MINUTE(C), 1440): oltre la mezzanotte conta il giorno dopo. */
export function durataMinuti(oraAllert, liberoOperativo) {
  if (!isOraValida(oraAllert) || !isOraValida(liberoOperativo)) return null;
  return (((minutiDaOra(liberoOperativo) - minutiDaOra(oraAllert)) % 1440) + 1440) % 1440;
}

export function meseDa(data) {
  return isDataValida(data) ? Number(data.slice(5, 7)) : null;
}

export function oraDelGiorno(oraAllert) {
  return isOraValida(oraAllert) ? Number(oraAllert.slice(0, 2)) : null;
}

/** Posizione del rientro − posizione dell'invio; vuoto se manca un codice o il rientro è NERO. */
export function deltaCodice(codiceInvio, codiceRientro) {
  if (!codiceInvio || !codiceRientro || codiceRientro === 'NERO') return null;
  const invio = SCALA_CODICI.indexOf(codiceInvio);
  const rientro = SCALA_CODICI.indexOf(codiceRientro);
  return invio < 0 || rientro < 0 ? null : rientro - invio;
}

export function calcolati(r) {
  return {
    durata: durataMinuti(r.oraAllert, r.liberoOperativo),
    mese: meseDa(r.data),
    ora: oraDelGiorno(r.oraAllert),
    delta: deltaCodice(r.codiceInvio, r.codiceRientro),
  };
}
