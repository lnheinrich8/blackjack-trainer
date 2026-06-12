// Chip denominations and their casino colors, shared by the bet buttons and the
// chip stacks drawn on the table.
export const CHIP_DEFS = [
    { value: 5, color: "red" },
    { value: 25, color: "green" },
    { value: 100, color: "black" },
    { value: 500, color: "purple" },
    { value: 1000, color: "blue" },
];

const COLOR_BY_VALUE = Object.fromEntries(
    CHIP_DEFS.map((chip) => [chip.value, chip.color]),
);

export const colorFor = (value) => COLOR_BY_VALUE[value] ?? "red";
