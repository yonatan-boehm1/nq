import React from "react";
import styled from "styled-components";
import { theme } from "../styles/theme";

export interface FibFormValues {
  start_date: string;
  long_entry_trigger: number | string;
  long_take_profit: number | string;
  long_stop_loss: number | string;
  short_entry_trigger: number | string;
  short_take_profit: number | string;
  short_stop_loss: number | string;
  range_start: string;
  range_end: string;
  direction: "long" | "short" | null;
  min_or_delta: string;
  max_or_delta: string;
}

interface Field {
  name: keyof FibFormValues;
  label: string;
  type: string;
}

interface Props {
  form: FibFormValues;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onDirectionChange: (val: "long" | "short" | null) => void;
  onSubmit: () => void;
  loading: boolean;
}

const FibForm = ({
  form,
  onChange,
  onDirectionChange,
  onSubmit,
  loading,
}: Props) => {
  const renderField = (name: keyof FibFormValues, label: string, type: string) => (
    <FieldContainer key={name}>
      <Label>{label}</Label>
      {type === "number" ? (
        <Select
          name={name}
          value={form[name] as string | number}
          onChange={onChange}
        >
          {["0", "0.272", "0.618", "1", "1.272", "1.618"].map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          name={name}
          type={type}
          value={form[name] as string}
          onChange={onChange}
        />
      )}
    </FieldContainer>
  );

  return (
    <Wrapper>
      <Grid>
        <Column>
          {renderField("start_date", "Start Date", "date")}
          {renderField("range_start", "Range Start (IL)", "time")}
          {renderField("range_end", "Range End (IL)", "time")}
          <FieldContainer>
            <Label>OR Δ Range</Label>
            <OrDeltaRow>
              <Input
                name="min_or_delta"
                type="number"
                placeholder="Min"
                value={form.min_or_delta}
                onChange={onChange}
                step="1"
              />
              <OrDeltaSep>–</OrDeltaSep>
              <Input
                name="max_or_delta"
                type="number"
                placeholder="Max"
                value={form.max_or_delta}
                onChange={onChange}
                step="1"
              />
            </OrDeltaRow>
          </FieldContainer>
        </Column>
        <Column>
          {renderField("long_entry_trigger", "Long Entry", "number")}
          {renderField("short_entry_trigger", "Short Entry", "number")}
          <DirectionContainer>
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
          </DirectionContainer>
        </Column>
        <Column>
          {renderField("long_take_profit", "Long TP", "number")}
          {renderField("short_take_profit", "Short TP", "number")}
        </Column>
        <Column>
          {renderField("long_stop_loss", "Long SL", "number")}
          {renderField("short_stop_loss", "Short SL", "number")}
          <ButtonContainer>
            <Button onClick={onSubmit} disabled={loading} $loading={loading}>
              {loading ? "Running..." : "Run →"}
            </Button>
          </ButtonContainer>
        </Column>
      </Grid>
    </Wrapper>
  );
};

export default FibForm;

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 40px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;

  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const DirectionContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin-top: auto;
`;

const FieldContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
`;

const ButtonContainer = styled.div`
  width: 100%;
  display: flex;
  margin-top: auto;
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

const OrDeltaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const OrDeltaSep = styled.span`
  color: ${theme.colors.textMuted};
  font-size: 12px;
  flex-shrink: 0;
`;

const Select = styled.select`
  background: ${theme.colors.surface};
  border: 1px solid ${theme.colors.border};
  border-radius: 2px;
  color: ${theme.colors.textPrimary};
  font-family: ${theme.fonts.mono};
  font-size: 14px;
  padding: 9px 14px;
  width: 100%;
  transition: border-color 0.15s;
  color-scheme: dark;
  appearance: none;
  cursor: pointer;

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
  width: 100%;
  height: 40px;

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
  height: 40px;
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
  padding: 0;
  height: 100%;
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
  white-space: nowrap;
`;
