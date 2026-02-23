import styled from "styled-components";
import { theme } from "../styles/theme";

interface Field {
  name: keyof FormValues;
  label: string;
  type: string;
}

export interface FormValues {
  start_date: string;
  take_profit: number | string;
  stop_loss: number | string;
  range_start: string;
  range_end: string;
}

interface Props {
  form: FormValues;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  loading: boolean;
}

const fields: Field[] = [
  { name: "start_date", label: "Start Date", type: "date" },
  { name: "take_profit", label: "Take Profit", type: "number" },
  { name: "stop_loss", label: "Stop Loss", type: "number" },
  { name: "range_start", label: "Range Start (NYC)", type: "time" },
  { name: "range_end", label: "Range End (NYC)", type: "time" },
];

const Form = ({ form, onChange, onSubmit, loading }: Props) => (
  <Wrapper>
    {fields.map((f) => (
      <Field key={f.name}>
        <Label>{f.label}</Label>
        <Input
          name={f.name}
          type={f.type}
          value={form[f.name]}
          onChange={onChange}
          step={f.type === "number" ? "0.1" : undefined}
        />
      </Field>
    ))}
    <Button onClick={onSubmit} disabled={loading} $loading={loading}>
      {loading ? "Running..." : "Run →"}
    </Button>
  </Wrapper>
);

export default Form;

const Wrapper = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr auto;
  gap: 16px;
  align-items: end;
  margin-bottom: 40px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.label`
  color: ${theme.colors.textSecondary};
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  font-family: ${theme.fonts.mono};
`;

const Input = styled.input`
  background: ${theme.colors.surface};
  border: 1px solid ${theme.colors.border};
  border-radius: 2px;
  color: ${theme.colors.textPrimary};
  font-family: ${theme.fonts.mono};
  font-size: 14px;
  padding: 10px 14px;
  width: 100%;
  transition: border-color 0.15s;
  color-scheme: dark;

  &:focus {
    outline: none;
    border-color: ${theme.colors.accent};
  }
`;

const Button = styled.button<{ $loading: boolean }>`
  background: ${({ $loading }) => ($loading ? "#1a1a1a" : "#fff")};
  color: ${({ $loading }) => ($loading ? theme.colors.textSecondary : "#000")};
  border: none;
  border-radius: 2px;
  font-family: ${theme.fonts.mono};
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 11px 28px;
  cursor: ${({ $loading }) => ($loading ? "not-allowed" : "pointer")};
  transition:
    background 0.15s,
    color 0.15s;
  white-space: nowrap;

  &:hover {
    background: ${({ $loading }) =>
      !$loading ? theme.colors.accent : "#1a1a1a"};
    color: ${({ $loading }) =>
      !$loading ? "#000" : theme.colors.textSecondary};
  }
`;
