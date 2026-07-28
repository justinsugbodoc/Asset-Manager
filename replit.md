# SugboDoc Patient Portal

A cloud-native Healthcare Operating System patient-facing portal for patients in the Philippines to access health records, appointments, bills, prescriptions, lab results, and messages with doctors.

## Run & Operate

- `pnpm --filter @workspace/sugbodoc run dev` — run the patient portal (dev)
- `pnpm run typecheck` — full typecheck across all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- React + Vite + Tailwind CSS
- React Router v6
- Recharts for charts
- lucide-react for icons
- Mock data only (no backend)

## Brand

- Primary: #4A4FC4 (indigo-blue)
- Secondary: #3A3FA0 (dark indigo)
- Accent: #E8E9FB (light indigo tint)
- Text: #1A1A2E (near-black)
- Success: #1D9E75, Warning: #F59E0B, Danger: #EF4444
- Font: Inter
- Logo: SugboDoc wordmark in #4A4FC4

## Responsive Breakpoints

- Mobile < 768px: single column, bottom tab bar navigation
- Tablet 768–1023px: 2-column grid, collapsible sidebar
- Desktop 1024px+: fixed left sidebar 240px, 3-column content grid
- All tap targets minimum 44px height

## Philippine Context

- Currency: Philippine Peso (₱)
- Clinics: Cebu Doctors' University Hospital, Perpetual Succour Hospital, Chong Hua Hospital, Vicente Sotto Memorial Medical Center
- Sample doctors: Dr. Maria Santos, Dr. Jose Reyes, Dr. Ana Villanueva
- Specialties: Internal Medicine, Cardiology, Pediatrics, OB-GYN, Dermatology
- Sample patient: Juan dela Cruz, 34M, Blood Type O+

## Where things live

- `artifacts/sugbodoc/` — React + Vite patient portal

## User preferences

_None yet._

## Gotchas

_Populate as you build._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
