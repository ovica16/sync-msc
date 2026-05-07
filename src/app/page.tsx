export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-blue-400">
          Sync MSC
        </h1>
        <p className="text-gray-400 text-lg">
          Sistema de Gestión de Mantenimiento — Planta Concentradora
        </p>
        <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
          {[
            { label: "Equipos", href: "/equipos" },
            { label: "Órdenes de Trabajo", href: "/ordenes" },
            { label: "Planes de Mantenimiento", href: "/planes" },
            { label: "Dashboard", href: "/dashboard" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="border border-blue-800 hover:border-blue-400 hover:bg-blue-950 rounded-lg p-4 transition-colors"
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
