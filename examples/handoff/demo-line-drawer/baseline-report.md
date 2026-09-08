# Demo line drawer baseline

This sanitized report represents the behavior evidence referenced by the demo
Flow Contract. It contains no product source, credentials or private URLs.

## Scope

A selected line is edited through one bounded detail drawer. Application,
routing, authentication, host and canvas ownership remain outside the slice.

## Observable scenario

Given a selected line with a valid length, when the user submits a new valid
length, then the displayed line uses the new length.

## Rendered-surface inventory

The selected-line drawer renders the Length and Angle fields as `migrate`, and
the Detectable capability branch, Coordinates, Done and Delete controls as
`retain-react`. Everything outside the drawer is `excluded`.

## Visual parity

The migrated Length and Angle fields have a directly comparable retained
counterpart in the same drawer. Both must keep the bordered field box, the icon
left of the label, the label above the value and the trailing unit inside the
box, using design tokens rather than literal colors. Both must also match the
width of the Detectable and Coordinates sections and keep the unit vertically
centered with the value. The contract records these as `visualParity` surfaces
`length-field` and `angle-field`, so they are verified as their own criteria
rather than as a side note to a functional scenario.
