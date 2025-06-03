function trace(p, d, step)
{
    color local, reflected, transmitted;
    point q;
    normal n;
    if (step > max) {
        return(backgroundColor);
    }
    q = intersect(p, d, lightStatus);
    if (lightStatus == light_source) {
        return(lightSourceColor);
    }
    if (lightStatus == no_intersection) {
        return(backgroundColor);
    }
    n = normal(q);
    r = reflect(q, n);
    t = transmit(q, n);
    local = phong(q, n, r);
    reflected = trace(q, r, step+1);
    transmitted = trace(q, t, step+1);
    
    return(local + reflected + transmitted);
}