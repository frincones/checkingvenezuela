"use client";

import { Package } from "lucide-react";

export function PackagesHeader() {
  return (
    <header>
      <section className="flex h-[500px] bg-gradient-to-br from-primary via-primary/90 to-primary/80 bg-cover bg-no-repeat px-[10%]">
        <div className="mt-20 max-w-[600px] self-start text-white">
          <div className="mb-4 flex items-center gap-3">
            <Package className="h-10 w-10" />
            <span className="text-sm font-semibold uppercase tracking-wider">
              Paquetes Turísticos
            </span>
          </div>

          <h1 className="mb-4 text-4xl font-bold sm:text-5xl lg:text-6xl">
            Experiencias Completas
          </h1>

          <p className="text-lg font-medium sm:text-xl lg:text-2xl">
            Vuelo + Hotel + Actividades. Todo lo que necesitas para tu aventura perfecta
          </p>

          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Sin preocupaciones</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Mejores precios</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Experiencias únicas</span>
            </div>
          </div>
        </div>
      </section>
    </header>
  );
}
