const test = `D: ====================== BEGIN A-ASSOCIATE-RQ =====================
D: Our Implementation Class UID:      1.2.276.0.7230010.3.0.3.6.6
D: Our Implementation Version Name:   OFFIS_DCMTK_366
D: Their Implementation Class UID:    
D: Their Implementation Version Name: 
D: Application Context Name:    1.2.840.10008.3.1.1.1
D: Calling Application Name:    ECHOSCU
D: Called Application Name:     ANY-SCP
D: Responding Application Name: ANY-SCP
D: Our Max PDU Receive Size:    16384
D: Their Max PDU Receive Size:  0
D: Presentation Contexts:
D:   Context ID:        1 (Proposed)
D:     Abstract Syntax: =VerificationSOPClass
D:     Proposed SCP/SCU Role: Default
D:     Proposed Transfer Syntax(es):
D:       =LittleEndianImplicit
D: Requested Extended Negotiation: none
D: Accepted Extended Negotiation:  none
D: Requested User Identity Negotiation: none
D: User Identity Negotiation Response:  none
D: ======================= END A-ASSOCIATE-RQ ======================`


let regex = new RegExp(`D: ====================== BEGIN A-ASSOCIATE-RQ =====================
D: Our Implementation Class UID:      ([\\d.]*)
D: Our Implementation Version Name:   ([a-zA-Z\\d_]*)
D: Their Implementation Class UID:    ([\\d.]*)
D: Their Implementation Version Name: ([a-zA-Z\\d_]*)
D: Application Context Name:    ([\\d.]*)
D: Calling Application Name:    (\\w*)
D: Called Application Name:     ([\\w-]*)
D: Responding Application Name: ([\\w-]*)
D: Our Max PDU Receive Size:    (\\d*)
D: Their Max PDU Receive Size:  (\\d*)
D: Presentation Contexts:
D:   Context ID:        (\\d*) \((\\w*)\)
D:     Abstract Syntax: =(\\w*)
D:     Proposed SCP\/SCU Role: (\\w*)
D:     Proposed Transfer Syntax\(es\):
D:       =(\\w*)
D: Requested Extended Negotiation: (\\w*)
D: Accepted Extended Negotiation:  (\\w*)
D: Requested User Identity Negotiation: (\\w*)
D: User Identity Negotiation Response:  (\\w*)
D: ======================= END A-ASSOCIATE-RQ ======================`)


regex = new RegExp(`D: ====================== BEGIN A-ASSOCIATE-RQ =====================
D: Our Implementation Class UID:      (?<OurImplementationClassUID>[\\d.]*)
D: Our Implementation Version Name:   (?<OurImplementationVersionName>[a-zA-Z\\d_]*)
D: Their Implementation Class UID:    (?<TheirImplementationClassUID>[\\d.]*)
D: Their Implementation Version Name: (?<TheirImplementationVersionName>[a-zA-Z\\d_]*)
D: Application Context Name:    (?<ApplicationContextName>[\\d.]*)
D: Calling Application Name:    (?<CallingApplicationName>\\w*)
D: Called Application Name:     (?<CalledApplicationName>[\\w-]*)
D: Responding Application Name: (?<RespondingApplicationName>[\\w-]*)
D: Our Max PDU Receive Size:    (?<OurMaxPDUReceiveSize>\\d*)
D: Their Max PDU Receive Size:  (?<TheirMaxPDUReceiveSize>\\d*)
D: Presentation Contexts:
D:   Context ID:        (?<ContextID>\\d*) \\((?<ContextIDText>\\w*)\\)
D:     Abstract Syntax: =(?<AbstractSyntax>\\w*)
D:     Proposed SCP\\/SCU Role: (?<ProposedSCP_SCURole>\\w*)
D:     Proposed Transfer Syntax\\(es\\):
D:       =(?<ProposedTransferSyntax>\\w*)
D: Requested Extended Negotiation: (?<RequestedExtendedNegotiation>\\w*)
D: Accepted Extended Negotiation:  (?<AcceptedExtendedNegotiation>\\w*)
D: Requested User Identity Negotiation: (?<RequestedUserIdentityNegotiation>\\w*)
D: User Identity Negotiation Response:  (?<UserIdentityNegotiationResponse>\\w*)
D: ======================= END A-ASSOCIATE-RQ ======================`, '')
console.log(regex.exec(test))

