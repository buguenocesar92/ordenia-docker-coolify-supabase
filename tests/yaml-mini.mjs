// Parser YAML mínimo, sin dependencias: mapas, listas, escalares, flow-lists y
// escalares de bloque. Cubre el subconjunto que usa un workflow de GitHub.
// Fuera de ese subconjunto lanza ErrorYaml en vez de adivinar.
// Existe para que la prueba de CI no dependa de PyYAML instalado a mano en la
// maquina: la CI corre en un runner donde nada garantiza ese paquete.
export class ErrorYaml extends Error {}

const nivelDe = (linea) => linea.length - linea.replace(/^ */, '').length;

const esVacia = (linea) => {
  const t = linea.trim();
  return t === '' || t.startsWith('#');
};

// Un '#' abre comentario solo si esta fuera de comillas y precedido de espacio.
function quitarComentario(linea) {
  let simple = false;
  let doble = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === "'" && !doble) simple = !simple;
    else if (c === '"' && !simple) doble = !doble;
    else if (c === '#' && !simple && !doble && (i === 0 || /\s/.test(linea[i - 1]))) return linea.slice(0, i);
  }
  return linea;
}

function escalar(bruto) {
  const s = bruto.trim();
  if (s === '') return null;
  if (s.length >= 2 && s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    try {
      return JSON.parse(s);
    } catch {
      return s.slice(1, -1);
    }
  }
  if (s.startsWith('[') && s.endsWith(']')) {
    const dentro = s.slice(1, -1).trim();
    if (dentro === '') return [];
    return dentro.split(',').map((p) => escalar(p));
  }
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~') return null;
  if (/^-?\d+$/.test(s)) return Number(s);
  return s;
}

function siguiente(ctx) {
  let j = ctx.i;
  while (j < ctx.lineas.length && esVacia(ctx.lineas[j])) j++;
  if (j >= ctx.lineas.length) return null;
  return { nivel: nivelDe(ctx.lineas[j]), texto: ctx.lineas[j].trim(), indice: j };
}

function parseEscalarBloque(ctx, nivel, indicador) {
  const partes = [];
  while (ctx.i < ctx.lineas.length) {
    const linea = ctx.lineas[ctx.i];
    if (linea.trim() === '') {
      const sig = siguiente(ctx);
      if (sig && sig.nivel > nivel) {
        partes.push('');
        ctx.i++;
        continue;
      }
      break;
    }
    if (nivelDe(linea) <= nivel) break;
    partes.push(linea.slice(nivel + 2));
    ctx.i++;
  }
  let texto = partes.join('\n').replace(/\s+$/, '');
  if (!indicador.endsWith('-')) texto += '\n';
  return texto;
}

function parseMapa(ctx, nivel) {
  const mapa = {};
  for (;;) {
    while (ctx.i < ctx.lineas.length && esVacia(ctx.lineas[ctx.i])) ctx.i++;
    if (ctx.i >= ctx.lineas.length) break;
    const linea = ctx.lineas[ctx.i];
    const n = nivelDe(linea);
    if (n < nivel) break;
    if (n > nivel) throw new ErrorYaml(`linea ${ctx.i + 1}: indentacion inesperada`);
    const recortada = linea.slice(n);
    if (recortada === '-' || recortada.startsWith('- ')) break;
    const sinComentario = quitarComentario(linea).trimEnd();
    const m = /^([^:]+):(.*)$/.exec(sinComentario);
    if (!m) throw new ErrorYaml(`linea ${ctx.i + 1}: no es una clave de YAML valida`);
    const clave = m[1].trim().replace(/^["']|["']$/g, '');
    const resto = m[2].trim();
    if (Object.hasOwn(mapa, clave)) throw new ErrorYaml(`linea ${ctx.i + 1}: clave duplicada "${clave}"`);
    ctx.i++;
    if (resto === '') {
      const sig = siguiente(ctx);
      if (sig && sig.nivel > nivel) mapa[clave] = parseBloque(ctx, sig.nivel);
      else if (sig && sig.nivel === nivel && (sig.texto === '-' || sig.texto.startsWith('- '))) mapa[clave] = parseLista(ctx, nivel);
      else mapa[clave] = null;
    } else if (/^[|>][-+]?\d*$/.test(resto)) {
      mapa[clave] = parseEscalarBloque(ctx, nivel, resto);
    } else {
      mapa[clave] = escalar(resto);
    }
  }
  return mapa;
}

function parseLista(ctx, nivel) {
  const lista = [];
  for (;;) {
    while (ctx.i < ctx.lineas.length && esVacia(ctx.lineas[ctx.i])) ctx.i++;
    if (ctx.i >= ctx.lineas.length) break;
    const linea = ctx.lineas[ctx.i];
    const n = nivelDe(linea);
    if (n < nivel) break;
    if (n > nivel) throw new ErrorYaml(`linea ${ctx.i + 1}: indentacion inesperada`);
    const recortada = linea.slice(n);
    if (recortada !== '-' && !recortada.startsWith('- ')) break;
    const resto = recortada.slice(1).trim();
    if (resto === '' || resto.startsWith('#')) {
      ctx.i++;
      const sig = siguiente(ctx);
      lista.push(sig && sig.nivel > nivel ? parseBloque(ctx, sig.nivel) : null);
      continue;
    }
    if (/^[^:]+:(\s|$)/.test(resto)) {
      // Elemento de lista que abre un mapa: se reindenta y se parsea como mapa.
      const sangria = n + 2;
      ctx.lineas[ctx.i] = ' '.repeat(sangria) + resto;
      lista.push(parseMapa(ctx, sangria));
    } else {
      ctx.i++;
      lista.push(escalar(quitarComentario(resto)));
    }
  }
  return lista;
}

function parseBloque(ctx, nivel) {
  const sig = siguiente(ctx);
  if (!sig) return null;
  if (sig.texto === '-' || sig.texto.startsWith('- ')) return parseLista(ctx, sig.nivel);
  return parseMapa(ctx, sig.nivel);
}

export function parseYaml(texto) {
  const lineas = texto.replace(/\r\n?/g, '\n').split('\n');
  lineas.forEach((linea, n) => {
    if (/^[ \t]*/.exec(linea)[0].includes('\t')) {
      throw new ErrorYaml(`linea ${n + 1}: la indentacion con tabulador no es valida`);
    }
  });
  const ctx = { lineas, i: 0 };
  const valor = parseBloque(ctx, 0);
  while (ctx.i < ctx.lineas.length && esVacia(ctx.lineas[ctx.i])) ctx.i++;
  if (ctx.i < ctx.lineas.length) throw new ErrorYaml(`linea ${ctx.i + 1}: contenido sin interpretar`);
  return valor;
}
