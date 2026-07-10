import { parseFamAppEmail } from "./parser.util";

const sampleEmail = `
FamApp Header
Hey Imraj Mondal,
You have successfully received

₹1.0
from MD ZISHAN MANDAL

Transaction ID :    FMPIB6110843917
Date :    01:14 AM IST, 10 July 2026
Updated Balance :    ₹552.6
UTR :    234721870425
Purpose :    DDDDDDD
If this was not done by you, call us and report this
at +91 8095858881 or email us at
support@famapp.in
`;

const result = parseFamAppEmail(sampleEmail);
console.log(result);
