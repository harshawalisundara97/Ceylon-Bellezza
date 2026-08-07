interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
}

export default function Tabs({ tabs, activeKey, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 border-b border-hairline">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab.key === activeKey
              ? "border-b-2 border-accent text-accent"
              : "text-taupe hover:text-ink"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
