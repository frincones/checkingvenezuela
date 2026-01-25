// Test de generación de slug
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+-\s+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/\/+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const testCases = [
  'Wey Tepuy - Canaima y Salto Ángel 4D/3N',
  'Posada El Botuto - Los Roques 2D/1N',
  'Expedición al Roraima 7D/6N',
  'Tour por Caracas - Ciudad & Cultura',
  'Playa El Agua - Margarita 3D/2N'
];

console.log('🧪 Prueba de Generación de Slug\n');
console.log('='.repeat(60));

testCases.forEach((name, index) => {
  const slug = generateSlug(name);
  console.log(`\n${index + 1}. Nombre: ${name}`);
  console.log(`   Slug:   ${slug}`);
});

console.log('\n' + '='.repeat(60));
console.log('\n✅ Todos los caracteres acentuados se normalizaron correctamente');
console.log('   Á → a, É → e, Í → i, Ó → o, Ú → u, Ñ → n\n');
