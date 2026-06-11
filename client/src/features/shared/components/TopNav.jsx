// Site top navigation. Train and Stats are live; Coach (AI) and Settings are
// roadmap placeholders shown as disabled "soon" items. Drill *modes* (single /
// multi hand) will live inside the Train page, not as top-level nav.

const NAV_ITEMS = [
    { id: "play", label: "Play", enabled: true },
    { id: "train", label: "Train", enabled: true },
    { id: "stats", label: "Stats", enabled: true },
    { id: "coach", label: "Coach", enabled: false },
    { id: "settings", label: "Settings", enabled: false },
];

function TopNav({ active, onSelect, glance }) {
    return (
        <header className="topnav">
            <div className="topnav__brand">
                <span>♠</span>
                <span>CC Trainer</span>
            </div>

            <nav className="topnav__links">
                {NAV_ITEMS.map((item) => (
                    <button
                        key={item.id}
                        className={`topnav__link ${active === item.id ? "is-active" : ""}`}
                        onClick={() => item.enabled && onSelect(item.id)}
                        disabled={!item.enabled}
                    >
                        {item.label}
                        {!item.enabled && <span className="topnav__soon">soon</span>}
                    </button>
                ))}
            </nav>

            {glance && <div className="topnav__glance">{glance}</div>}
        </header>
    );
}

export default TopNav;
