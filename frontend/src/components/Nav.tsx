import { NavLink } from "react-router-dom";
import styled from "styled-components";
import { theme } from "../styles/theme";

const Nav = () => (
  <Wrapper>
    <Link to="/">Backtest</Link>
    <Link to="/results">Results</Link>
    <Link to="/fib">Fibonacci</Link>
    <Link to="/chart">Chart</Link>
  </Wrapper>
);

export default Nav;

const Wrapper = styled.nav`
  display: flex;
  gap: 24px;
  padding: 20px 40px;
  border-bottom: 1px solid ${theme.colors.border};
  background: ${theme.colors.bg};
  font-family: ${theme.fonts.mono};
`;

const Link = styled(NavLink)`
  color: ${theme.colors.textSecondary};
  text-decoration: none;
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  transition: color 0.15s;

  &:hover {
    color: ${theme.colors.textPrimary};
  }

  &.active {
    color: ${theme.colors.accent};
  }
`;
