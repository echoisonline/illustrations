export const METAPHOR_PRESETS = [
  {
    title: "Знания под рукой",
    ids: ["kniga", "telefon"],
    facet: "знание",
    idea: "Телефон на книге: доступ к знаниям в одном касании.",
  },
  {
    title: "Сложное становится простым",
    ids: ["telefon", "pazl"],
    facet: "продукт",
    idea: "Пазл на экране: цифровой продукт соединяет части решения.",
  },
  {
    title: "Идея обретает форму",
    ids: ["papka", "ruchka", "lampa"],
    facet: "идея",
    idea: "Лампа, ручка и папка: замысел превращается в оформленную работу.",
  },
  {
    title: "Бюджет под контролем",
    ids: ["koshelek", "moneta", "lampa"],
    facet: "деньги",
    idea: "Кошелёк и монета в свете лампы: осознанное управление деньгами.",
  },
  {
    title: "В своём ритме",
    ids: ["naushniki", "vaza"],
    facet: "ритм",
    idea: "Наушники и цветы: личный ритм в спокойном пространстве.",
  },
  {
    title: "История складывается",
    ids: ["kniga", "pazl", "ruchka"],
    facet: "авторство",
    idea: "Книга, пазл и ручка: отдельные мысли складываются в историю.",
  },
] as const;

const normalize = (value: string) => value.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").replace(/[.!?]+$/, "");

export function metaphorPreset(brief: string) {
  const title = normalize(brief);
  return METAPHOR_PRESETS.find((preset) => normalize(preset.title) === title);
}

export const FEATURED_METAPHORS = METAPHOR_PRESETS.slice(0, 3);
