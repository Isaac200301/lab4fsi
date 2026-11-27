import type { Metadata } from "next";
import { Bricolage_Grotesque, Newsreader } from "next/font/google";
import "./globals.css";
import { SesionProvider } from "@/context/Sesion";
import { CarritoProvider } from "@/context/Carrito";
import { Encabezado } from "@/components/Encabezado";

const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Folio · Libros electrónicos y ediciones impresas",
  description: "Compra eBooks con descarga inmediata o recibe la edición impresa en tu casa.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${newsreader.variable} ${bricolage.variable}`}>
      <body>
        <SesionProvider>
          <CarritoProvider>
            <Encabezado />
            <main className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">{children}</main>
            <footer className="border-t border-linea py-8 text-sm text-lapiz">
              <div className="mx-auto max-w-6xl px-4 sm:px-6">
                Folio es una tienda de demostración del Laboratorio 4 de Fundamentos de Sistemas de Información (UdeA). Los pagos usan PayPal Sandbox: no se cobra dinero real.
              </div>
            </footer>
          </CarritoProvider>
        </SesionProvider>
      </body>
    </html>
  );
}
