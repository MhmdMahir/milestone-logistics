import { useState, useEffect } from 'react';
import { Dropdown, Form, Button } from 'react-bootstrap';

const today = () => new Date().toISOString().split('T')[0];

function FloatAction() {
  const [simDate, setSimDate] = useState(() => {
    const saved = localStorage.getItem('simDate');
    return saved && saved >= today() ? saved : today();
  });

  useEffect(() => {
    localStorage.setItem('simDate', simDate);
    window.dispatchEvent(new Event('simDateChanged'));
  }, [simDate]);

  const handleDateChange = (e) => {
    if (e.target.value && e.target.value >= today()) {
      setSimDate(e.target.value);
    }
  };

  const addDays = (days) => {
    const current = new Date(simDate);
    current.setDate(current.getDate() + days);
    setSimDate(current.toISOString().split('T')[0]);
  };

  const resetToday = () => {
    setSimDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <div
      className="position-fixed"
      style={{
        bottom: '42px',
        right: '20px',
        zIndex: 1040
      }}
    >
      <Dropdown drop="up" align="end">
        <Dropdown.Toggle
          variant="light"
          size="sm"
          id="dropdown-sim-date"
          className="d-inline-flex align-items-center gap-2 border shadow-sm rounded-pill px-3 py-1 text-dark fw-semibold"
          style={{ fontSize: '0.78rem' }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            fill="currentColor"
            className="bi bi-calendar-event text-primary"
            viewBox="0 0 16 16"
          >
            <path d="M11 6.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5z" />
            <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z" />
          </svg>
          <span>Sim Date: {simDate}</span>
        </Dropdown.Toggle>

        <Dropdown.Menu className="p-3 shadow-lg border-secondary-subtle rounded-3" style={{ width: '240px' }}>
          <div className="fw-bold small mb-2 text-dark">Simulated Platform Date</div>
          
          <Form.Group className="mb-2">
            <Form.Control
              type="date"
              size="sm"
              min={today()}
              value={simDate}
              onChange={handleDateChange}
            />
          </Form.Group>

          <div className="d-flex gap-1 mt-2">
            <Button variant="outline-primary" size="sm" className="flex-fill px-1 py-0" style={{ fontSize: '0.7rem' }} onClick={() => addDays(1)}>
              +1 Day
            </Button>
            <Button variant="outline-primary" size="sm" className="flex-fill px-1 py-0" style={{ fontSize: '0.7rem' }} onClick={() => addDays(7)}>
              +7 Days
            </Button>
            <Button variant="outline-secondary" size="sm" className="flex-fill px-1 py-0" style={{ fontSize: '0.7rem' }} onClick={resetToday}>
              Today
            </Button>
          </div>
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
}

export default FloatAction;
