import styled from "styled-components";
import { theme } from "../styles/theme";

interface Field {
  name: keyof FormValues;
  label: string;
  type: string;
}

export interface FormValues {
  start_date: string;
  long_take_profit: number | string;
  long_stop_loss: number | string;
  short_take_profit: number | string;
  short_stop_loss: number | string;
  range_start: string;
  range_end: string;
  direction: "long" | "short" | null;
}

interface Props {
  form: FormValues;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDirectionChange: (val: "long" | "short" | null) => void;
  onSubmit: () => void;
  loading: boolean;
}

const fields: Field[] = [
  { name: "start_date", label: "Start Date", type: "date" },
  { name: "long_take_profit", label: "Long TP", type: "number" },
  { name: "long_stop_loss", label: "Long SL", type: "number" },
  { name: "short_take_profit", label: "Short TP", type: "number" },
  { name: "short_stop_loss", label: "Short SL", type: "number" },
  { name: "range_start", label: "Range Start", type: "time" },
  { name: "range_end", label: "Range End", type: "time" },
];

const Form = ({
  form,
  onChange,
  onDirectionChange,
  onSubmit,
  loading,
}: Props) => (
  <Wrapper>
    {fields.map((f) => (
      <Field key={f.name}>
        <Label>{f.label}</Label>
        <Input
          name={f.name}
          type={f.type}
          value={form[f.name] as string}
          onChange={onChange}
          step={f.type === "number" ? "0.1" : undefined}
        />
      </Field>
    ))}
    <Field>
      <Label>Direction</Label>
      <DirectionButtons>
        <DirectionBtn
          $active={form.direction === "long"}
          $color={theme.colors.accentBlue}
          onClick={() =>
            onDirectionChange(form.direction === "long" ? null : "long")
          }
        >
          Long
        </DirectionBtn>
        <DirectionBtn
          $active={form.direction === "short"}
          $color={theme.colors.accentOrange}
          onClick={() =>
            onDirectionChange(form.direction === "short" ? null : "short")
          }
        >
          Short
        </DirectionBtn>
      </DirectionButtons>
    </Field>
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

const DirectionButtons = styled.div`
  display: flex;
  gap: 8px;
  height: 100%;
`;

const DirectionBtn = styled.button<{ $active: boolean; $color: string }>`
  flex: 1;
  background: ${({ $active, $color }) => ($active ? $color : "transparent")};
  color: ${({ $active, $color }) => ($active ? "#000" : $color)};
  border: 1px solid ${({ $color }) => $color};
  border-radius: 2px;
  font-family: ${theme.fonts.mono};
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 6px 0;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
  white-space: nowrap;
`;
