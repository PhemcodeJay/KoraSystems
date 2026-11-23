import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const router = useRouter();
  const params = useSearchParams();
  // Start with a non-admin demo email; account picker will override it.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Demo@1234");