# FreshMart: First-Level Technical Proposition & Scope of Work Document

**Document Type:** First-Level Technical & Project Proposition (Request for Executive Review)  
**Target Market:** Village Kirana Stores, General Provisions, Bakeries, Neighborhood Supermarkets  
**Platform Stack:** Cross-Platform React Native (Expo SDK 57), Node.js / Express, MongoDB  
**Author:** Technical Architecture & Solutions Team  

---

## 1. Executive Summary & Business Proposition

**FreshMart** is a zero-hardware, mobile-first, multi-tenant digital operating system engineered specifically for local neighborhood merchants, grocery shops, provision stores, and retail supermarkets.

Unlike traditional retail ERP systems that demand complex inventory cataloging and expensive specialized hardware (e.g., barcode scanners, POS terminals, monthly rental soundbox speakers), **FreshMart delivers an agile, zero-hardware platform**:
- **Voice-Activated Quick Sales & Ledger:** Record sales, purchases, and cash flows in 2 seconds via natural speech.
- **Daily Galla (Cash Register) Balancing:** Automated real-time cash ledger with 30-second day-end physical count verification.
- **Free Mobile Voice Soundbox:** Eliminates hardware audio soundbox rental fees (saving ₹1,200–₹1,800/year per store).
- **Direct-to-Bank 0% Commission UPI Settlement:** Direct NPCI UPI routing bypassing 2% third-party gateway deductions.
- **Multi-Tenant Shop Isolation:** Each shopkeeper manages their own customer ledger, branding, and personal/business UPI VPA.

---

## 2. Problem Statement & Market Solution Matrix

| Operational Challenge | Traditional Approach / Competitors | FreshMart Innovation & Proposition |
| :--- | :--- | :--- |
| **High Typing Friction** | Manual mobile typing during rush hours leads to skipped entries and lost records. | **Voice-Activated POS:** Multi-lingual speech-to-intent parsing logs entries in under 2 seconds. |
| **Hardware Soundbox Rental** | Payment aggregators charge ₹100–₹150/month rent for physical speaker hardware. | **In-App Mobile Soundbox:** Uses the smartphone speaker for high-fidelity audio chimes and voice announcements for ₹0. |
| **Gateway Deductions & Delays** | 2% processing fees + 24–48 hour settlement delays into escrow accounts. | **Direct Bank NPCI UPI Routing:** Dynamic VPA resolution with instant 100% credit directly into the shop's bank account. |
| **Cash Drawer (Galla) Leaks** | Loose paper slips and unaccounted change lead to daily cash discrepancies at closing. | **Daily Galla Reconciliation:** Real-time formula balancing opening cash, quick sales, debt collections, and drawer expenses. |
| **Morning Regulars Routine** | 50+ customers take daily milk or water cans, tracked with manual calendar strokes. | **Morning Regulars "Parcha" Checklist:** 1-tap attendance-style batch recording updating 20+ accounts in 5 seconds. |
| **Bad Debts & Overdue Credit** | Merchants extend credit blindly without historical repayment visibility. | **Credit Risk Badges:** Dynamic traffic-light health indicator (🟢 Good, 🟡 Attention, 🔴 High Risk) with safety override warnings. |

---

## 3. Detailed Scope of Work (SOW)

### 3.1. In-Scope Functional Modules
1. **Multi-Tenant Architecture & Dynamic UPI Resolution:**
   - Dedicated store profiles (Shop Name, UPI ID/VPA, Phone, Address, Category).
   - Strict database tenant isolation ensuring Shop A and Shop B data never mix.
   - Dynamic UPI link and QR code generation specific to each shopkeeper's bank account.
2. **Voice-to-Sale & Natural Language POS Assistant:**
   - Spoken natural language commands: *"56 note on sale"*, *"Ramesh 2kg sugar 80"*, *"Suresh paid 200"*, *"Tea expense 30"*.
   - Instant entity extraction with zero typing.
3. **Daily Galla (Cash Register & Day-End Balancing):**
   - Formula: `Opening Cash + Quick Cash Sales + Udhaar Cash Collected - Drawer Expenses = Expected Cash`.
   - Day-end physical cash drawer audit with automated variance feedback (`Balanced`, `Short`, `Excess`).
4. **Built-in Mobile Voice Soundbox:**
   - Web Audio chime + native text-to-speech payment announcement engine.
5. **Customer Credit Ledger (Udhaar Khata) & Smart Dispatch:**
   - Customer account creation with contact details and credit limits.
   - **Smart Fallback:** WhatsApp invite generation; if no WhatsApp number is provided, automatically routes credentials, passbook links, and statements via **Email**.
6. **Credit Risk Scoring & Default Shield:**
   - Automated rating algorithm based on overdue aging and credit utilization.
7. **Morning Regulars ("Parcha" Subscription Tally):**
   - Batch recording for daily milk packets, water cans, and bread routines.
8. **AI Paper Chit & Receipt OCR Scanner:**
   - Vision parser for handwritten counter slips and distributor bills.
9. **Printable Counter QR Standee & Customer Self-Service Portal:**
   - 1-tap printable high-resolution counter poster with shop branding and UPI QR code.
   - Customer passbook app with 1-tap **"Pay via UPI"** button deep-linked to banking apps.

### 3.2. Deliberate Out-of-Scope Items
- **Complex Warehouse Inventory SKUs:** Excluded to keep counter workflows ultra-fast for retail grocers.
- **Third-Party Delivery Logistics:** Excluded as local neighborhood retailers cater to walk-in counter trade.

---

## 4. User Roles & Access Control Matrix (RBAC)

| Functional Area | Super Admin | Shop Owner (Merchant) | Customer (End User) |
| :--- | :--- | :--- | :--- |
| **Store Profile & UPI Setup** | Full Platform Oversight | Configure Own Shop & UPI | View Linked Shop Info |
| **Customer Ledger & Credit** | Aggregated Metrics | Full Ledger Control (Add/Edit) | Read-only Self Passbook |
| **Daily Cash Register (Galla)** | Audit Logs | Full Opening/Closing Drawer Control | No Access |
| **Voice POS Assistant** | Configuration | Full Voice Sales Entry | No Access |
| **Morning Regulars Tally** | Configuration | Setup Items & Run Batch Logging | View Own Subscriptions |
| **Direct UPI Payments** | Rail Health Monitoring | Receive Direct Bank Settlement | Execute 1-Tap UPI Payment |
| **WhatsApp / Email Reminders**| Service Settings | Trigger 1-Tap Reminders | Receive Statements & Bills |

---

## 5. Technical Architecture & Technology Stack

- **Cross-Platform Client:** React Native / Expo (SDK 57) + NativeWind (TailwindCSS) with responsive UI across Web, Android, and iOS.
- **Backend API Layer:** Node.js & Express 5.x RESTful architecture with modular controllers and services.
- **Database & Tenant Isolation:** MongoDB with Mongoose ODM implementing strict `{ shopId: req.shopId }` query encapsulation.
- **Voice & Speech Engine:** Web SpeechRecognition API + native SpeechSynthesizer for offline and online voice capability.
- **Notification Services:** Nodemailer SMTP engine + dynamic WhatsApp deep-link generation.

---

## 6. Implementation Phasing & Milestones

| Milestone | Phase Focus | Key Deliverables | Status |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Multi-Tenant Core & Khata | Shop Onboarding, Customer Ledger, Credit Sales, Direct UPI | Ready for Deployment |
| **Phase 2** | Voice POS & Daily Galla | Speech-to-Sale Assistant, Mobile Soundbox, Cash Register | Ready for Deployment |
| **Phase 3** | Smart Automation & Regulars | Morning Milk Tally, AI Chit Scanner, Risk Scoring, Email Fallback | Ready for Deployment |
| **Phase 4** | Pilot Rollout & Distribution | 25+ Local Pilot Stores, Counter QR Standee Distribution, User Training | Planned Rollout |

---

## 7. Cost Analysis, Financial Impact & ROI

| Area | Traditional Solution Cost | FreshMart Cost & Impact |
| :--- | :--- | :--- |
| **Audio Voice Soundbox** | ₹1,200 – ₹1,800/year per store rental | **₹0 / Free** (Uses existing smartphone speaker) |
| **Payment Gateway Fees** | 2% deduction on all digital receipts | **0% Commission** (Direct NPCI UPI settlement) |
| **Daily Reconciliation Time** | 30–45 mins manual paper tallying | **< 1 Minute** (30-second automated day-end audit) |
| **Overdue Debt Recovery** | Slow recovery due to manual awkwardness | **+35% Faster** (Automated deep-linked UPI reminders) |

---

## 8. Executive Sign-Off & Project Approval

| Submitted By | Approved & Accepted By |
| :--- | :--- |
| **Name:** Project Architecture Team<br>**Title:** Full-Stack Solutions Architect<br>**Date:** ________________________<br>**Signature:** ____________________ | **Name:** ________________________<br>**Title:** Executive Director / Management Reviewer<br>**Date:** ________________________<br>**Signature:** ____________________ |
