import { useState } from "react";

const router = useRouter();
  const params = useSearchParams();
  // Start with a non-admin demo email; account picker will override it.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Demo@1234");