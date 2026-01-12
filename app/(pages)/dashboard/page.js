import { createClient } from "@/lib/db/supabase/server";
import Link from "next/link";

async function getStats() {
  const supabase = await createClient();

  // Get leads count by status
  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .select("status");

  // Get quotations count by status
  const { data: quotations, error: quotationsError } = await supabase
    .from("quotations")
    .select("status");

  // Get support tickets count by status
  const { data: tickets, error: ticketsError } = await supabase
    .from("support_tickets")
    .select("status");

  const leadsStats = {
    total: leads?.length || 0,
    new: leads?.filter(l => l.status === "new").length || 0,
    contacted: leads?.filter(l => l.status === "contacted").length || 0,
    quoting: leads?.filter(l => l.status === "quoting").length || 0,
  };

  const quotationsStats = {
    total: quotations?.length || 0,
    draft: quotations?.filter(q => q.status === "draft").length || 0,
    sent: quotations?.filter(q => q.status === "sent").length || 0,
    accepted: quotations?.filter(q => q.status === "accepted").length || 0,
  };

  const ticketsStats = {
    total: tickets?.length || 0,
    open: tickets?.filter(t => t.status === "open").length || 0,
    inProgress: tickets?.filter(t => t.status === "in_progress").length || 0,
    resolved: tickets?.filter(t => t.status === "resolved").length || 0,
  };

  return { leadsStats, quotationsStats, ticketsStats, leadsError, quotationsError, ticketsError };
}

function StatCard({ title, value, subtitle, href, color }) {
  return (
    <Link href={href} className="block">
      <div className={`rounded-lg bg-white p-6 shadow-md transition-shadow hover:shadow-lg border-l-4 ${color}`}>
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
      </div>
    </Link>
  );
}

function QuickAction({ title, description, href, icon }) {
  return (
    <Link href={href} className="flex items-center gap-4 rounded-lg bg-white p-4 shadow-md transition-shadow hover:shadow-lg">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <h4 className="font-semibold text-gray-900">{title}</h4>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const { leadsStats, quotationsStats, ticketsStats, leadsError, quotationsError, ticketsError } = await getStats();

  const tablesNotCreated = leadsError?.code === "42P01" || quotationsError?.code === "42P01" || ticketsError?.code === "42P01";

  if (tablesNotCreated) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard CRM</h1>
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-6">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">Configuracion Pendiente</h2>
          <p className="text-yellow-700 mb-4">
            Las tablas del CRM no han sido creadas en la base de datos.
            Necesitas ejecutar la migracion SQL en Supabase.
          </p>
          <div className="bg-white rounded p-4 border">
            <p className="text-sm text-gray-600 mb-2">Ejecuta el archivo:</p>
            <code className="text-sm bg-gray-100 px-2 py-1 rounded">
              supabase/migrations/001_crm_tables.sql
            </code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard CRM</h1>
        <p className="text-sm text-gray-500">CheckIn Venezuela - Panel de Gestion</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Leads Totales"
          value={leadsStats.total}
          subtitle={`${leadsStats.new} nuevos`}
          href="/dashboard/leads"
          color="border-blue-500"
        />
        <StatCard
          title="Leads Nuevos"
          value={leadsStats.new}
          subtitle="Requieren atencion"
          href="/dashboard/leads?status=new"
          color="border-green-500"
        />
        <StatCard
          title="Cotizaciones"
          value={quotationsStats.total}
          subtitle={`${quotationsStats.sent} enviadas`}
          href="/dashboard/quotations"
          color="border-purple-500"
        />
        <StatCard
          title="Tickets Abiertos"
          value={ticketsStats.open + ticketsStats.inProgress}
          subtitle="Pendientes de resolver"
          href="/dashboard/support"
          color="border-orange-500"
        />
      </div>

      {/* Leads Pipeline Summary */}
      <div className="rounded-lg bg-white p-6 shadow-md">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Pipeline de Ventas</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{leadsStats.new}</p>
            <p className="text-xs text-gray-500">Nuevos</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-indigo-600">{leadsStats.contacted}</p>
            <p className="text-xs text-gray-500">Contactados</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{leadsStats.quoting}</p>
            <p className="text-xs text-gray-500">Cotizando</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-600">{quotationsStats.sent}</p>
            <p className="text-xs text-gray-500">Cot. Enviadas</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{quotationsStats.accepted}</p>
            <p className="text-xs text-gray-500">Aceptadas</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600">{quotationsStats.total}</p>
            <p className="text-xs text-gray-500">Total Cot.</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg bg-white p-6 shadow-md">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Acciones Rapidas</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <QuickAction
            title="Ver Leads Nuevos"
            description="Gestionar prospectos sin atender"
            href="/dashboard/leads?status=new"
            icon={
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            }
          />
          <QuickAction
            title="Crear Cotizacion"
            description="Nueva cotizacion para cliente"
            href="/dashboard/quotations/new"
            icon={
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            }
          />
          <QuickAction
            title="Tickets Pendientes"
            description="Resolver solicitudes de soporte"
            href="/dashboard/support?status=open"
            icon={
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            }
          />
        </div>
      </div>
    </div>
  );
}
