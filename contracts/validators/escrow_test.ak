use aiken/crypto.{VerificationKeyHash}
use cardano/address.{Address}
use cardano/assets
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction,
}
use escrow.{
  Action, ActivateDispute, ArbitratorRuling, Disputed, EscrowDatum, Locked,
  MutualRelease, Resolved,
}

const key_a: VerificationKeyHash =
  #"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

const key_b: VerificationKeyHash =
  #"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

const key_arb: VerificationKeyHash =
  #"cccccccccccccccccccccccccccccccccccccccccccccccccccccccc"

const key_other: VerificationKeyHash =
  #"dddddddddddddddddddddddddddddddddddddddddddddddddddddddd"

const script_hash: ByteArray =
  #"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"

const amount: Int = 100_000_000

const own_ref: OutputReference =
  OutputReference {
    transaction_id: #"0000000000000000000000000000000000000000000000000000000000000000",
    output_index: 0,
  }

fn addr(key: VerificationKeyHash) -> Address {
  address.from_verification_key(key)
}

fn script_address() -> Address {
  address.from_script(script_hash)
}

fn datum(state: escrow.State) -> EscrowDatum {
  EscrowDatum {
    party_a: addr(key_a),
    party_b: addr(key_b),
    arbitrator: addr(key_arb),
    amount,
    deadline: 1_800_000_000_000,
    state,
  }
}

fn escrow_output(d: EscrowDatum) -> Output {
  let data: Data = d
  Output {
    address: script_address(),
    value: assets.from_lovelace(amount),
    datum: InlineDatum(data),
    reference_script: None,
  }
}

fn pay(key: VerificationKeyHash, lovelace: Int) -> Output {
  Output {
    address: addr(key),
    value: assets.from_lovelace(lovelace),
    datum: NoDatum,
    reference_script: None,
  }
}

fn tx(
  d: EscrowDatum,
  outputs: List<Output>,
  signers: List<VerificationKeyHash>,
) -> Transaction {
  Transaction {
    ..transaction.placeholder,
    inputs: [Input { output_reference: own_ref, output: escrow_output(d) }],
    outputs,
    extra_signatories: signers,
  }
}

fn run(d: EscrowDatum, action: Action, self: Transaction) -> Bool {
  escrow.escrow.spend(Some(d), action, own_ref, self)
}

// --- MutualRelease ----------------------------------------------------------

test mutual_release_signed_by_both_succeeds() {
  let d = datum(Locked)
  let outputs = [pay(key_a, 30_000_000), pay(key_b, 70_000_000)]
  run(
    d,
    MutualRelease { to_a: 30_000_000, to_b: 70_000_000 },
    tx(d, outputs, [key_a, key_b]),
  )
}

test mutual_release_all_to_b_succeeds() {
  let d = datum(Locked)
  run(
    d,
    MutualRelease { to_a: 0, to_b: amount },
    tx(d, [pay(key_b, amount)], [key_a, key_b]),
  )
}

test mutual_release_while_disputed_succeeds() {
  let d = datum(Disputed)
  let outputs = [pay(key_a, 50_000_000), pay(key_b, 50_000_000)]
  run(
    d,
    MutualRelease { to_a: 50_000_000, to_b: 50_000_000 },
    tx(d, outputs, [key_a, key_b]),
  )
}

test mutual_release_without_b_signature_fails() fail {
  let d = datum(Locked)
  let outputs = [pay(key_a, 30_000_000), pay(key_b, 70_000_000)]
  run(
    d,
    MutualRelease { to_a: 30_000_000, to_b: 70_000_000 },
    tx(d, outputs, [key_a]),
  )
}

test mutual_release_without_a_signature_fails() fail {
  let d = datum(Locked)
  let outputs = [pay(key_a, 30_000_000), pay(key_b, 70_000_000)]
  run(
    d,
    MutualRelease { to_a: 30_000_000, to_b: 70_000_000 },
    tx(d, outputs, [key_b]),
  )
}

test mutual_release_split_not_matching_amount_fails() fail {
  let d = datum(Locked)
  let outputs = [pay(key_a, 30_000_000), pay(key_b, 60_000_000)]
  run(
    d,
    MutualRelease { to_a: 30_000_000, to_b: 60_000_000 },
    tx(d, outputs, [key_a, key_b]),
  )
}

test mutual_release_paying_less_than_split_fails() fail {
  let d = datum(Locked)
  let outputs = [pay(key_a, 30_000_000), pay(key_other, 70_000_000)]
  run(
    d,
    MutualRelease { to_a: 30_000_000, to_b: 70_000_000 },
    tx(d, outputs, [key_a, key_b]),
  )
}

test mutual_release_negative_share_fails() fail {
  let d = datum(Locked)
  let outputs = [pay(key_b, 110_000_000)]
  run(
    d,
    MutualRelease { to_a: -10_000_000, to_b: 110_000_000 },
    tx(d, outputs, [key_a, key_b]),
  )
}

test mutual_release_when_resolved_fails() fail {
  let d = datum(Resolved)
  let outputs = [pay(key_a, 30_000_000), pay(key_b, 70_000_000)]
  run(
    d,
    MutualRelease { to_a: 30_000_000, to_b: 70_000_000 },
    tx(d, outputs, [key_a, key_b]),
  )
}

// --- ActivateDispute --------------------------------------------------------

fn disputed_output(d: EscrowDatum) -> Output {
  escrow_output(EscrowDatum { ..d, state: Disputed })
}

test activate_dispute_by_a_succeeds() {
  let d = datum(Locked)
  run(d, ActivateDispute, tx(d, [disputed_output(d)], [key_a]))
}

test activate_dispute_by_b_succeeds() {
  let d = datum(Locked)
  run(d, ActivateDispute, tx(d, [disputed_output(d)], [key_b]))
}

test activate_dispute_by_arbitrator_fails() fail {
  let d = datum(Locked)
  run(d, ActivateDispute, tx(d, [disputed_output(d)], [key_arb]))
}

test activate_dispute_when_already_disputed_fails() fail {
  let d = datum(Disputed)
  run(d, ActivateDispute, tx(d, [disputed_output(d)], [key_a]))
}

test activate_dispute_keeping_locked_state_fails() fail {
  let d = datum(Locked)
  run(d, ActivateDispute, tx(d, [escrow_output(d)], [key_a]))
}

test activate_dispute_changing_arbitrator_fails() fail {
  let d = datum(Locked)
  let out = escrow_output(
    EscrowDatum { ..d, arbitrator: addr(key_a), state: Disputed },
  )
  run(d, ActivateDispute, tx(d, [out], [key_a]))
}

test activate_dispute_draining_value_fails() fail {
  let d = datum(Locked)
  let out = Output {
    ..disputed_output(d),
    value: assets.from_lovelace(1_000_000),
  }
  run(d, ActivateDispute, tx(d, [out, pay(key_a, 99_000_000)], [key_a]))
}

// --- ArbitratorRuling -------------------------------------------------------

test arbitrator_ruling_succeeds() {
  let d = datum(Disputed)
  let outputs = [pay(key_a, 25_000_000), pay(key_b, 75_000_000)]
  run(
    d,
    ArbitratorRuling { to_a: 25_000_000, to_b: 75_000_000 },
    tx(d, outputs, [key_arb]),
  )
}

test arbitrator_ruling_all_to_a_succeeds() {
  let d = datum(Disputed)
  run(
    d,
    ArbitratorRuling { to_a: amount, to_b: 0 },
    tx(d, [pay(key_a, amount)], [key_arb]),
  )
}

test arbitrator_ruling_without_arbitrator_signature_fails() fail {
  let d = datum(Disputed)
  let outputs = [pay(key_a, 25_000_000), pay(key_b, 75_000_000)]
  run(
    d,
    ArbitratorRuling { to_a: 25_000_000, to_b: 75_000_000 },
    tx(d, outputs, [key_a, key_b]),
  )
}

test arbitrator_ruling_while_locked_fails() fail {
  let d = datum(Locked)
  let outputs = [pay(key_a, 25_000_000), pay(key_b, 75_000_000)]
  run(
    d,
    ArbitratorRuling { to_a: 25_000_000, to_b: 75_000_000 },
    tx(d, outputs, [key_arb]),
  )
}

test arbitrator_ruling_split_not_matching_amount_fails() fail {
  let d = datum(Disputed)
  let outputs = [pay(key_a, 25_000_000), pay(key_b, 85_000_000)]
  run(
    d,
    ArbitratorRuling { to_a: 25_000_000, to_b: 85_000_000 },
    tx(d, outputs, [key_arb]),
  )
}

test arbitrator_ruling_paying_arbitrator_instead_fails() fail {
  let d = datum(Disputed)
  let outputs = [pay(key_a, 25_000_000), pay(key_arb, 75_000_000)]
  run(
    d,
    ArbitratorRuling { to_a: 25_000_000, to_b: 75_000_000 },
    tx(d, outputs, [key_arb]),
  )
}

// --- general ----------------------------------------------------------------

test two_escrow_inputs_fail() fail {
  let d = datum(Disputed)
  let outputs = [pay(key_a, 25_000_000), pay(key_b, 75_000_000)]
  let base = tx(d, outputs, [key_arb])
  let other = Input {
    output_reference: OutputReference { ..own_ref, output_index: 1 },
    output: escrow_output(d),
  }
  run(
    d,
    ArbitratorRuling { to_a: 25_000_000, to_b: 75_000_000 },
    Transaction { ..base, inputs: [other, ..base.inputs] },
  )
}
