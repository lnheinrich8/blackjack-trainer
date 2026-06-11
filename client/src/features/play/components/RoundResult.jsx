// Shown under the table once a round is settled: the net chip swing (tone-colored
// by sign) and a prompt to deal the next hand with Enter.
function RoundResult({ net }) {
  const tone = net > 0 ? "win" : net < 0 ? "lose" : "push";
  const label =
    net > 0 ? `You win +$${net}` : net < 0 ? `You lose $${-net}` : "Push";

  return (
    <div className={`play__result feedback--${tone}`}>
      <h2>{label}</h2>
      <p className="belt__keys">
        Press <strong>Spacebar</strong> for the next hand.
      </p>
    </div>
  );
}

export default RoundResult;
