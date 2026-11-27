import { Suspense } from "react";
import { FormularioCuenta } from "@/components/FormularioCuenta";

export default function Registro() {
  return (
    <Suspense>
      <FormularioCuenta modo="registro" />
    </Suspense>
  );
}
