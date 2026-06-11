import { colorFor } from "../chips";

const STACK_OFFSET = 9; // vertical px each chip in a pile peeks above the next

// Draws the current bet as chip stacks on the felt — one pile per denomination,
// highest value on the left. Clicking a stack removes one chip of that value
// from the bet. `chips` is the raw list of placed chip values.
function ChipStacks({ chips, onRemove }) {
  const counts = {};
  for (const value of chips) counts[value] = (counts[value] ?? 0) + 1;
  const values = Object.keys(counts)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="chipstacks">
      {values.map((value) => {
        const count = counts[value];
        const height = 48 + (count - 1) * STACK_OFFSET;
        return (
          <button
            type="button"
            className="chipstack"
            key={value}
            onClick={() => onRemove(value)}
            title={`Remove one $${value} chip`}
          >
            <div className="chipstack__pile" style={{ height }}>
              {Array.from({ length: count }, (_, i) => (
                <span
                  key={i}
                  className={`chip chip--token chip--${colorFor(value)}`}
                  style={{ bottom: i * STACK_OFFSET }}
                >
                  ${value}
                </span>
              ))}
            </div>
            <span className="chipstack__count">×{count}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ChipStacks;
