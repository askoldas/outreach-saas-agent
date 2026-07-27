const countryLanguages: Readonly<Record<string, readonly string[]>> = {
  AT: ["German"],
  BE: ["Dutch", "French"],
  BG: ["Bulgarian"],
  CH: ["German", "French", "Italian"],
  CY: ["Greek"],
  CZ: ["Czech"],
  DE: ["German"],
  DK: ["Danish"],
  EE: ["Estonian"],
  ES: ["Spanish"],
  FI: ["Finnish", "Swedish"],
  FR: ["French"],
  GR: ["Greek"],
  HR: ["Croatian"],
  HU: ["Hungarian"],
  IE: ["English", "Irish"],
  IS: ["Icelandic"],
  IT: ["Italian"],
  LT: ["Lithuanian"],
  LU: ["Luxembourgish", "French", "German"],
  LV: ["Latvian"],
  MT: ["Maltese", "English"],
  NL: ["Dutch"],
  NO: ["Norwegian"],
  PL: ["Polish"],
  PT: ["Portuguese"],
  RO: ["Romanian"],
  SE: ["Swedish"],
  SI: ["Slovenian"],
  SK: ["Slovak"],
  WORLDWIDE: ["English"],
};

export function deriveDiscoveryLanguages(input: {
  countryCodes: readonly string[];
}): string[] {
  const localLanguages = input.countryCodes.flatMap(
    (code) => countryLanguages[code.trim().toUpperCase()] ?? [],
  );
  return unique([...localLanguages, "English"]);
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
