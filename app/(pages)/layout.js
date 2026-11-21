import { Nav } from "@/components/sections/Nav";
import { Footer } from "@/components/sections/Footer";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

import routes from "@/data/routes.json";
export default async function PagesLayout({ children }) {
  const navNotAllowedPaths = [
    routes.login.path,
    routes.signup.path,
    routes["forgot-password"].path,
    routes["verify-password-reset-code"].path,
    routes["set-new-password"].path,
  ];

  // Dashboard has its own layout, so don't show nav/footer
  const dashboardPaths = ["/dashboard"];

  const session = await auth();
  const currentPathname = headers().get("x-pathname") || "";

  const isDashboard = dashboardPaths.some((path) =>
    currentPathname.startsWith(path)
  );

  // `currentPathname.startsWith(path)` y no al reves.
  //
  // La version anterior comparaba `path.startsWith(currentPathname)`, con los
  // operandos invertidos. Daba el resultado correcto en todas las rutas reales
  // (verificado una por una), asi que el fallo era invisible, pero se rompia en
  // un caso concreto: cuando `currentPathname` es la cadena vacia.
  //
  // Y esa cadena vacia no es hipotetica: la linea de arriba hace `|| ""`. Si
  // X-Pathname no llegara, toda ruta cumpliria `path.startsWith("")` -> true,
  // `isNavAllowed` seria false, y la cabecera y el pie DESAPARECERIAN de todo
  // el sitio publico sin que nada fallara de forma visible.
  //
  // Con el orden correcto ese caso degrada al lado seguro: se muestran.
  const isNavAllowed = !isDashboard && !navNotAllowedPaths.some((path) =>
    currentPathname.startsWith(path)
  );

  return (
    <>
      {isNavAllowed && <Nav session={session} type="default" />}
      {children}
      {isNavAllowed && <Footer />}
    </>
  );
}
