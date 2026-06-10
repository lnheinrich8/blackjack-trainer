import { useState } from "react";
import GuessInput from "../../shared/components/GuessInput";

// Shown under the table when the drill pauses to ask for the running count.
// Holds its own input value and hands the submitted string up to TableDrill.
function CountPrompt({ onSubmit, busy }) {
  const [value, setValue] = useState("");

  const submit = () => {
    if (value !== "") onSubmit(value);
  };

  return (
    <div className="panel countbelt">
      <GuessInput
        value={value}
        onChange={setValue}
        onSubmit={submit}
        busy={busy}
      />
    </div>
  );
}

export default CountPrompt;
