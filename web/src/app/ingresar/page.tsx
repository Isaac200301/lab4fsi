import { Suspense } from "react";
import { FormularioCuenta } from "@/components/FormularioCuenta";

export default function Ingresar() {
  return (
    <Suspense>
      <FormularioCuenta modo="ingresar" />
    </Suspense>
  );
}
