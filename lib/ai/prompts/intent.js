/**
 * Safety guards (jailbreak / off-topic) — heurísticas SIN LLM.
 *
 * El intent classifier completo (booking/policy/etc.) se eliminó: el modelo
 * razona qué tool llamar a partir de las tool descriptions + el bloque FACTS.
 *
 * Lo único que queda acá son los guards de seguridad: detección de prompt
 * injection y mensajes claramente fuera de dominio. Estos SÍ son
 * deterministas y baratos (regex), y deben correr ANTES del LLM porque la
 * superficie de ataque es real.
 *
 * Si en el futuro queremos volver al classifier (modelo nuevo más débil que
 * no rute bien), el reemplazo está en git history pre-commit-7.
 */

/**
 * Detector de jailbreak / prompt injection (heurística simple).
 */
export function isJailbreakAttempt(message) {
  if (!message) return false;
  const t = message.toLowerCase();
  return (
    /ignor[ae] (tus |las )?(instrucciones|reglas|prompt|system)/.test(t) ||
    /eres ahora (chatgpt|gpt|claude|gemini|openai|otro|otra)/.test(t) ||
    /you are now (chatgpt|gpt|claude|gemini|openai)/.test(t) ||
    /reveal (your )?(system )?prompt/.test(t) ||
    /muestrame (tu )?(system )?prompt/.test(t) ||
    /act as (a |an )?[a-z]+ (without|sin) restriction/.test(t) ||
    /jailbreak|dan mode|developer mode/.test(t)
  );
}

/**
 * Detector de off-topic (cosas claramente fuera del dominio de viajes).
 */
export function isOffTopic(message) {
  if (!message) return false;
  const t = message.toLowerCase();
  // Programación / código
  if (
    /\b(javascript|python|java\b|react|nextjs|html|css|sql|c\+\+|c#|typescript|node\.js|node js|nodejs|api rest|event loop|promise|async|await)\b/.test(
      t
    )
  )
    return true;
  // Matemáticas / fórmulas
  if (/\b(integral|derivada|ecuaci[oó]n|teorema|sumatoria|f[oó]rmula matem)/.test(t)) return true;
  // Recetas / cocina
  if (/\b(receta|cocinar|ingredient|hornear)/.test(t)) return true;
  // Salud / médico
  if (/\b(s[ií]ntoma|enfermedad|diagn[oó]stico|medicament|dolor de|fiebre|cancer|covid|vacuna)/.test(t))
    return true;
  // Asesoría legal/financiera no-viajes
  if (/\b(impuesto|inversiones?|criptomoneda|bitcoin|ethereum|forex|trading bursátil)\b/.test(t)) return true;
  // Tareas escolares
  if (/\b(tarea|deber|trabajo escolar|ayuda con mi tarea)/.test(t)) return true;
  return false;
}

/**
 * Devuelve uno de: 'jailbreak' | 'off_topic' | 'human_handoff' | null.
 *
 * Solo detecta los casos que necesitan handling especial ANTES del LLM:
 *   - jailbreak / off_topic → canned response (sin LLM)
 *   - human_handoff → forzar tool talkToHuman (zero ambiguity)
 *
 * El resto (booking, policy, info, complaint, chitchat) es trabajo del LLM
 * con sus tool descriptions + FACTS.
 */
export function classifySafetyIntent(message) {
  if (!message) return null;
  if (isJailbreakAttempt(message)) return "jailbreak";
  if (isOffTopic(message)) return "off_topic";

  const t = message.toLowerCase().trim();
  // Handoff explícito a humano: el usuario pide expresamente un asesor.
  // Mantener este match es valioso: nos permite pinear la tool talkToHuman
  // y evitar que el modelo invente una larga respuesta de "te conecto…".
  if (
    /\b(asesor|asesora|humano|humana|agente real|persona real|hablar con (?:una? )?(persona|humano|alguien)|talk to (?:a )?human|real person|whatsapp)/.test(
      t
    )
  ) {
    return "human_handoff";
  }
  return null;
}
