// Shared by the stomach and esophagus wall materials.
export const stomachWallWave = `
float stomachWallWave(float along, float seconds) {
  float travel = along * 17.0 - seconds * 2.85;
  float wave = pow(max(0.0, sin(travel)), 3.0);
  float broad = .5 + .5 * sin(along * 7.0 - seconds * 1.55);
  return wave * .31 + broad * .045;
}
`;
